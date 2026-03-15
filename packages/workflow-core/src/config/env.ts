import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WORKFLOW_DATA_ROOT: z
    .string()
    .nonempty()
    .default(process.cwd() + "/data"),
  NANOBANANA_API_KEY: z.string().nonempty().optional(),
  NANOBANANA_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  NANOBANANA_MODEL: z.string().default("gemini-3.1-flash-image-preview"),
  /** When "true", skip the real API call and use the reference image as output (for local testing when API is unreachable). */
  NANOBANANA_DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1")
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = EnvSchema.parse(process.env);
  }
  return cachedEnv;
}

