import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Next only auto-loads `.env*` from `packages/web`. Merge monorepo root `.env` for keys
 * still unset (mirrors `@fashionmentum/workflow-core` env). Runs in Node when config loads.
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
    /* ignore unreadable root .env */
  }
}

mergeMonorepoRootEnvIntoProcessEnv();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@fashionmentum/workflow-core"],
  serverExternalPackages: ["@google-cloud/storage"],
  outputFileTracingRoot: resolve(__dirname, "../../"),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
