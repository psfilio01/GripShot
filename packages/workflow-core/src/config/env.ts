import dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

dotenv.config();

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
  NANOBANANA_API_KEY: z.string().nonempty().optional(),
  NANOBANANA_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  NANOBANANA_MODEL: z.string().default("gemini-3.1-flash-image-preview"),
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

