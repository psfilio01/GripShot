import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "fs-extra";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { getEnv } from "../config/env";
import type { MainImageMetrics } from "../domain/imageVariant";
import { GenerationCancelledError, throwIfGenerationCancelled, type GenerationControl } from "./generationCancellation";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_QUEUE = 8;
const WORKER_TIMEOUT_MS = 8 * 60 * 1000;
const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const Metrics = z.object({
  version: z.string(), model: z.string(), modelSha256: z.string(), sourceSha256: z.string(),
  width: z.number().int().positive(), height: z.number().int().positive(),
  requiresReview: z.literal(true),
  checks: z.object({ pureWhiteBackground: z.literal(true), opaqueProductUnchanged: z.literal(true) }).passthrough(),
  warnings: z.array(z.string()).default([]),
}).passthrough();

// One CPU inference at a time per instance, including in Next's separately loaded routes.
const globalState = globalThis as typeof globalThis & {
  __gripshotMainQueue?: { busy: boolean; waiting: Array<() => void> };
};
const queue = globalState.__gripshotMainQueue ??= { busy: false, waiting: [] };

async function acquireWorker(control?: GenerationControl): Promise<() => void> {
  await throwIfGenerationCancelled(control);
  if (queue.waiting.length >= MAX_QUEUE) throw new Error("The Main-image queue is full. Please try again shortly.");
  if (queue.busy) {
    await new Promise<void>((resolveWait, rejectWait) => {
      const remove = () => {
        const index = queue.waiting.indexOf(start);
        if (index !== -1) queue.waiting.splice(index, 1);
        clearTimeout(queueTimeout);
        control?.signal?.removeEventListener("abort", cancel);
      };
      const start = () => { remove(); resolveWait(); };
      const cancel = () => { remove(); rejectWait(new GenerationCancelledError()); };
      // Keep the entire after-response lifecycle below the HTTP platform timeout.
      const queueTimeout = setTimeout(() => { remove(); rejectWait(new Error("The Main-image queue is busy. Please try again shortly.")); }, 90_000);
      queue.waiting.push(start);
      control?.signal?.addEventListener("abort", cancel, { once: true });
      if (control?.signal?.aborted) cancel();
    });
  } else queue.busy = true;
  return () => {
    const next = queue.waiting.shift();
    if (next) next();
    else queue.busy = false;
  };
}

export function resolveMainImageRuntime(): { python: string; worker: string; model: string } {
  let root = process.cwd();
  while (!existsSync(join(root, "scripts", "main-image", "worker.py")) && dirname(root) !== root) root = dirname(root);
  const worker = process.env.MAIN_IMAGE_WORKER_PATH || join(root, "scripts", "main-image", "worker.py");
  const localPython = join(root, "vendor", "main-image", ".venv", "bin", "python");
  return {
    python: process.env.MAIN_IMAGE_PYTHON || (existsSync(localPython) ? localPython : "python3"),
    worker: resolve(worker),
    model: resolve(process.env.MAIN_IMAGE_MODEL_PATH || join(root, "vendor", "main-image", "birefnet.onnx")),
  };
}

function sha256(data: Buffer | string): string { return createHash("sha256").update(data).digest("hex"); }
const digestCache = new Map<string, { stamp: string; digest: string }>();
async function fileDigest(path: string): Promise<string> {
  const info = await fs.stat(path);
  const stamp = `${info.size}:${info.mtimeMs}`;
  if (digestCache.get(path)?.stamp === stamp) return digestCache.get(path)!.digest;
  const digest = await new Promise<string>((accept, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => accept(hash.digest("hex")));
  });
  digestCache.set(path, { stamp, digest });
  return digest;
}

export async function runMainImageWorker(
  source: Buffer,
  preserveShadow: boolean,
  control?: GenerationControl,
): Promise<{ buffer: Buffer; metrics: MainImageMetrics; sourceSha256: string }> {
  if (!source.length || source.length > MAX_SOURCE_BYTES) throw new Error("Main images must be non-empty and no larger than 25 MB.");
  const release = await acquireWorker(control);
  let temporaryDirectory: string | undefined;
  try {
    await throwIfGenerationCancelled(control);
    const runtime = resolveMainImageRuntime();
    if (!existsSync(runtime.worker) || !existsSync(runtime.model)) {
      throw new Error("The local Main-image worker/model is missing. Run pnpm setup:main-image first.");
    }
    const sourceSha256 = sha256(source);
    const [workerHash, modelHash] = await Promise.all([fileDigest(runtime.worker), fileDigest(runtime.model)]);
    const key = sha256(JSON.stringify({ sourceSha256, preserveShadow, workerHash, modelHash }));
    const cacheRoot = join(getEnv().WORKFLOW_DATA_ROOT, ".cache", "main-images");
    const cached = join(cacheRoot, key);
    const readResult = async (directory: string, verifyCachedBytes = false) => {
      const metrics = Metrics.parse(await fs.readJson(join(directory, "metrics.json"))) as MainImageMetrics;
      if (metrics.sourceSha256 !== sourceSha256 || metrics.modelSha256 !== modelHash || metrics.width * metrics.height > 25_000_000) {
        throw new Error("Main-image validation returned invalid source/model/dimensions.");
      }
      const buffer = await fs.readFile(join(directory, "output.png"));
      if (!buffer.subarray(0, 8).equals(PNG_HEADER)) throw new Error("Main-image worker did not return a lossless PNG.");
      if (verifyCachedBytes && (await fs.readFile(join(directory, "output.sha256"), "utf8")).trim() !== sha256(buffer)) {
        throw new Error("The cached Main image changed; recomputing it.");
      }
      return { buffer, metrics, sourceSha256 };
    };
    try {
      const hit = await readResult(cached, true);
      await throwIfGenerationCancelled(control);
      return hit;
    } catch (error) {
      if (error instanceof GenerationCancelledError) throw error;
      // Partial/old cache entries are never trusted; recompute using pinned worker/model.
    }
    temporaryDirectory = await fs.mkdtemp(join(tmpdir(), "gripshot-main-"));
    await fs.writeFile(join(temporaryDirectory, "source"), source);
    const args = [runtime.worker, "--input", join(temporaryDirectory, "source"), "--output", join(temporaryDirectory, "output.png"),
      "--metrics", join(temporaryDirectory, "metrics.json"), "--model", runtime.model];
    if (!preserveShadow) args.push("--no-shadow");
    await executeWorker(runtime.python, args, control);
    await throwIfGenerationCancelled(control);
    const result = await readResult(temporaryDirectory);
    await fs.ensureDir(cached);
    await fs.copyFile(join(temporaryDirectory, "output.png"), join(cached, "output.png"));
    await fs.copyFile(join(temporaryDirectory, "metrics.json"), join(cached, "metrics.json"));
    await fs.writeFile(join(cached, "output.sha256"), sha256(result.buffer), "utf8");
    // Bound the per-instance cache; entries contain only disposable derived copies.
    const entries = await fs.readdir(cacheRoot, { withFileTypes: true });
    const directories = await Promise.all(entries.filter((item) => item.isDirectory() && /^[a-f0-9]{64}$/.test(item.name))
      .map(async (item) => ({ path: join(cacheRoot, item.name), time: (await fs.stat(join(cacheRoot, item.name))).mtimeMs })));
    for (const entry of directories.sort((a, b) => b.time - a.time).slice(8)) await fs.remove(entry.path);
    return result;
  } finally {
    if (temporaryDirectory) await fs.remove(temporaryDirectory).catch(() => {});
    release();
  }
}

async function executeWorker(python: string, args: string[], control?: GenerationControl): Promise<void> {
  await throwIfGenerationCancelled(control);
  await new Promise<void>((accept, reject) => {
    const child = spawn(python, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, PYTHONUNBUFFERED: "1", OMP_NUM_THREADS: "2" } });
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    let cancellationCheckFailed = false;
    let killTimer: NodeJS.Timeout | undefined;
    let polling = false;
    const stop = () => {
      child.kill("SIGTERM");
      killTimer ??= setTimeout(() => child.kill("SIGKILL"), 3000);
      killTimer.unref();
    };
    const cancel = () => { cancelled = true; stop(); };
    control?.signal?.addEventListener("abort", cancel, { once: true });
    if (control?.signal?.aborted) cancel();
    const timeout = setTimeout(() => { timedOut = true; stop(); }, WORKER_TIMEOUT_MS);
    const poll = setInterval(() => {
      if (polling || !control?.isCancelled) return;
      polling = true;
      Promise.resolve(control.isCancelled()).then((value) => { if (value) cancel(); }).catch(() => {
        // Fail closed if cancellation/ownership can no longer be checked.
        cancellationCheckFailed = true;
        stop();
      }).finally(() => { polling = false; });
    }, 2000);
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-4000); });
    const cleanup = () => {
      clearTimeout(timeout); clearInterval(poll);
      if (killTimer) clearTimeout(killTimer);
      control?.signal?.removeEventListener("abort", cancel);
    };
    child.on("error", (error) => { cleanup(); reject(new Error(`Main-image worker could not start: ${error.message}. Run pnpm setup:main-image.`)); });
    child.on("close", (code) => {
      cleanup();
      if (cancellationCheckFailed) reject(new Error("Main-image processing stopped because permission/cancellation checks failed. Please try again."));
      else if (cancelled) reject(new GenerationCancelledError());
      else if (timedOut) reject(new Error("The Main-image worker timed out. Try a smaller image."));
      else if (code !== 0) reject(new Error(`Main-image processing failed: ${stderr.trim() || `exit ${code}`}`));
      else accept();
    });
  });
}
