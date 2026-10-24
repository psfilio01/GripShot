import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

dotenv.config();

/**
 * `pnpm dev` runs with cwd `packages/web`; Next.js does not load the monorepo root `.env`.
 * Merge root `.env` only for keys still unset so `packages/web/.env.local` / Next wins.
 */
function mergeMonorepoRootEnvIntoProcessEnv(): void {
  const cwd = process.cwd();
  const posixCwd = cwd.replace(/\\/g, "/");
  const match = posixCwd.match(/^(.*)\/packages\/[^/]+$/i);
  const monorepoRoot = match?.[1];
  if (!monorepoRoot) return;

  const rootEnvPath = resolve(monorepoRoot, ".env");
  if (!existsSync(rootEnvPath)) return;

  try {
    const parsed = dotenv.parse(readFileSync(rootEnvPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Unreadable root .env should not break the app
  }
}

mergeMonorepoRootEnvIntoProcessEnv();

/**
 * When Next.js runs from `packages/web`, default `cwd + "/data"` points at
 * `packages/web/data` while the web app serves images from repo `data/`.
 * Prefer the monorepo `data` folder when it exists.
 */
export function inferDefaultWorkflowDataRoot(): string {
  const cwd = process.cwd();
  const posixCwd = cwd.replace(/\\/g, "/");
  const isWebPackage = /\/packages\/web$/i.test(posixCwd);

  if (isWebPackage) {
    const repoData = resolve(cwd, "..", "..", "data");
    if (existsSync(repoData)) {
      return repoData;
    }
  }

  return resolve(cwd, "data");
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKFLOW_DATA_ROOT: z.string().nonempty().optional(),
  /**
   * When set, product/model/background reference blobs and generated images are stored in this
   * GCS bucket (object keys mirror paths under WORKFLOW_DATA_ROOT). Uses Application Default Credentials.
   */
  WORKFLOW_GCS_BUCKET: z.string().optional(),
  NANOBANANA_API_KEY: z.string().nonempty().optional(),
  NANOBANANA_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  /** Image generation (Custom Workflow steps, listing shots, Telegram, etc.). Must be an image-capable Gemini model. */
  NANOBANANA_MODEL: z.string().default("gemini-3.1-flash-image-preview"),
  /** Text-only model for custom workflow plan / replan JSON (structured output). Cheaper than image models. */
  NANOBANANA_PLANNER_MODEL: z.string().default("gemini-2.5-flash"),
  /** When "true", skip the real API call and use the reference image as output (for local testing when API is unreachable). */
  NANOBANANA_DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1")
});

export type Env = Omit<z.infer<typeof EnvSchema>, "WORKFLOW_DATA_ROOT"> & {
  WORKFLOW_DATA_ROOT: string;
};

let cachedEnv: Env | null = null;

/** Reset the cached env (test use only). */
export function _resetEnvCache(): void {
  cachedEnv = null;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    const parsed = EnvSchema.parse(process.env);
    cachedEnv = {
      ...parsed,
      WORKFLOW_DATA_ROOT:
        parsed.WORKFLOW_DATA_ROOT ?? inferDefaultWorkflowDataRoot(),
    };
  }
  return cachedEnv;
}

/** Resolved data root (same value image generation and metadata use). */
export function getWorkflowDataRoot(): string {
  return getEnv().WORKFLOW_DATA_ROOT;
}

