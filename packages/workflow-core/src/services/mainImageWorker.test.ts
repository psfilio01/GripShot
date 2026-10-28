import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), dataRoot: "" }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("../config/env", () => ({ getEnv: () => ({ WORKFLOW_DATA_ROOT: mocks.dataRoot }) }));
import { runMainImageWorker } from "./mainImageWorker";
const hash = (input: Buffer | string) => createHash("sha256").update(input).digest("hex");
let directory: string;
let child: EventEmitter & { stderr: EventEmitter; kill: ReturnType<typeof vi.fn> };
let resolveSpawn: (() => void) | undefined;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
describe("Main image worker orchestration", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    directory = await fs.mkdtemp(join(tmpdir(), "gripshot-main-test-"));
    mocks.dataRoot = directory;
    vi.stubEnv("MAIN_IMAGE_WORKER_PATH", join(directory, "worker.py"));
    vi.stubEnv("MAIN_IMAGE_MODEL_PATH", join(directory, "model.onnx"));
    await fs.writeFile(join(directory, "worker.py"), "worker-v1");
    await fs.writeFile(join(directory, "model.onnx"), "model-v1");
    mocks.spawn.mockImplementation((_python: string, args: string[]) => {
      child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }) });
      const index = (flag: string) => args[args.indexOf(flag) + 1];
      resolveSpawn = () => {
        void (async () => {
          const source = await fs.readFile(index("--input"));
          await fs.writeFile(index("--output"), png);
          await fs.writeJson(index("--metrics"), { version: "v1", model: "test-model", modelSha256: hash("model-v1"), sourceSha256: hash(source), width: 64, height: 64, requiresReview: true, checks: { pureWhiteBackground: true, opaqueProductUnchanged: true }, warnings: [] });
          child.emit("close", 0);
        })();
      };
      queueMicrotask(() => resolveSpawn?.());
      return child;
    });
  });
  afterEach(async () => { vi.unstubAllEnvs(); await fs.remove(directory); });
  it("uses the subprocess result and caches by source, shadow option, worker and model", async () => {
    const source = Buffer.from("source-bytes");
    const first = await runMainImageWorker(source, true);
    expect(first.buffer).toEqual(png);
    expect(first.sourceSha256).toBe(hash(source));
    await runMainImageWorker(source, true);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    await runMainImageWorker(source, false);
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(mocks.spawn.mock.calls[1][1]).toContain("--no-shadow");
    await fs.writeFile(join(directory, "worker.py"), "worker-v2-changed");
    await runMainImageWorker(source, true);
    expect(mocks.spawn).toHaveBeenCalledTimes(3);
    // Unique temporary sources are deleted even when the derived cache is retained.
    const firstArgs = mocks.spawn.mock.calls[0][1] as string[];
    expect(await fs.pathExists(firstArgs[firstArgs.indexOf("--input") + 1])).toBe(false);
  });
  it("rejects oversized inputs before launching inference", async () => {
    await expect(runMainImageWorker(Buffer.alloc(10 * 1024 * 1024 + 1), true)).rejects.toThrow("10 MB");
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("kills active inference when cancelled and releases the queue", async () => {
    mocks.spawn.mockImplementation(() => {
      child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }) });
      return child;
    });
    const controller = new AbortController();
    const result = runMainImageWorker(Buffer.from("source"), true, { signal: controller.signal });
    const assertion = expect(result).rejects.toThrow("cancelled");
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));
    controller.abort();
    await assertion;
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    const args = mocks.spawn.mock.calls[0][1] as string[];
    expect(await fs.pathExists(args[args.indexOf("--input") + 1])).toBe(false);
  });
  it("does not launch a queued job after it is cancelled", async () => {
    mocks.spawn.mockImplementation(() => {
      child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }) });
      return child;
    });
    const firstController = new AbortController();
    const first = runMainImageWorker(Buffer.from("first"), true, { signal: firstController.signal });
    const firstAssertion = expect(first).rejects.toThrow("cancelled");
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));
    const queuedController = new AbortController();
    const queued = runMainImageWorker(Buffer.from("second"), true, { signal: queuedController.signal });
    const queuedAssertion = expect(queued).rejects.toThrow("cancelled");
    queuedController.abort();
    await queuedAssertion;
    firstController.abort();
    await firstAssertion;
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });
  it("stops safely but reports a failed permission check instead of silently treating it as user cancellation", async () => {
    mocks.spawn.mockImplementation(() => {
      child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn(() => { queueMicrotask(() => child.emit("close", null)); return true; }) });
      return child;
    });
    let offline = false;
    const result = runMainImageWorker(Buffer.from("source"), true, { isCancelled: async () => {
      if (offline) throw new Error("database offline");
      return false;
    } });
    const assertion = expect(result).rejects.toThrow("permission/cancellation checks failed");
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));
    offline = true;
    await assertion;
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
