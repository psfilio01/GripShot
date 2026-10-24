import { execFile } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { promisify } from "node:util";
import { getEnv } from "../config/env";

const execFileAsync = promisify(execFile);

const BINARY_NAME = "realesrgan-ncnn-vulkan";

/**
 * Resolves the path to the Real-ESRGAN binary.
 * Search order: REALESRGAN_BIN env, bundled in /app/bin (Docker), local vendor dir, PATH.
 */
function findBinaryPath(): string | null {
  const fromEnv = process.env.REALESRGAN_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const bundledPaths = [
    "/app/bin/realesrgan-ncnn-vulkan",
    join(process.cwd(), "vendor", "realesrgan-ncnn-vulkan", BINARY_NAME),
    join(process.cwd(), "..", "..", "vendor", "realesrgan-ncnn-vulkan", BINARY_NAME),
  ];

  for (const p of bundledPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

let cachedBinaryPath: string | null | undefined;
let startupCheckDone = false;

export function getRealesrganBinaryPath(): string | null {
  if (cachedBinaryPath === undefined) {
    cachedBinaryPath = findBinaryPath();
  }
  return cachedBinaryPath;
}

/**
 * Run once at import / first API call. Logs whether the upscaler is available.
 * Safe to call multiple times; only logs on the first invocation.
 */
export function checkUpscalerOnStartup(): void {
  if (startupCheckDone) return;
  startupCheckDone = true;

  const env = getEnv();
  if (env.NANOBANANA_DRY_RUN) {
    console.info("[Real-ESRGAN] Dry-run mode — upscale will copy input as-is.");
    return;
  }

  const bin = getRealesrganBinaryPath();
  if (bin) {
    console.info(`[Real-ESRGAN] Binary found at ${bin}`);
  } else {
    console.warn(
      "[Real-ESRGAN] Binary NOT found. 4K upscale will be unavailable. " +
      "Run scripts/setup-realesrgan.sh or set REALESRGAN_BIN env variable.",
    );
  }
}

export function isUpscalerAvailable(): boolean {
  if (getEnv().NANOBANANA_DRY_RUN) return true;
  return getRealesrganBinaryPath() !== null;
}

/** Reset cached binary path and startup flag (for tests). */
export function _resetBinaryCache(): void {
  cachedBinaryPath = undefined;
  startupCheckDone = false;
}

export interface UpscaleResult {
  outputPath: string;
  dryRun: boolean;
}

/**
 * Derive the 4K output path from an input path.
 * `generated/abc/img.png` → `generated/abc/img-4k.png`
 */
export function upscaledPath(inputPath: string): string {
  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  return join(dirname(inputPath), `${base}-4k${ext}`);
}

/**
 * Upscale an image using Real-ESRGAN.
 *
 * In dry-run mode, copies input to output unchanged (for dev/test without the binary).
 *
 * @param inputPath  Absolute path to source image
 * @param outputPath Absolute path for upscaled result
 * @param scale      Upscale factor (2 or 4). Default: 4
 */
export async function upscaleImage(
  inputPath: string,
  outputPath: string,
  scale: 2 | 4 = 4,
): Promise<UpscaleResult> {
  const env = getEnv();

  if (env.NANOBANANA_DRY_RUN) {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    copyFileSync(inputPath, outputPath);
    return { outputPath, dryRun: true };
  }

  const bin = getRealesrganBinaryPath();
  if (!bin) {
    throw new Error(
      "Real-ESRGAN binary not found. Install via scripts/setup-realesrgan.sh or set REALESRGAN_BIN env.",
    );
  }

  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const modelDir = process.env.REALESRGAN_MODEL_DIR
    ?? join(dirname(bin), "models");

  const args = [
    "-i", inputPath,
    "-o", outputPath,
    "-n", "realesrgan-x4plus",
    "-s", String(scale),
  ];

  if (existsSync(modelDir)) {
    args.push("-m", modelDir);
  }

  try {
    await execFileAsync(bin, args, { timeout: 120_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Real-ESRGAN upscale failed: ${msg}`);
  }

  return { outputPath, dryRun: false };
}
