import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

/**
 * Next.js only auto-loads `.env*` from `packages/web`. Merge monorepo root `.env`
 * for keys still unset (same behavior as `@fashionmentum/workflow-core` config).
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
    /* Ignore an unreadable optional root .env file. */
  }
}

mergeMonorepoRootEnvIntoProcessEnv();
