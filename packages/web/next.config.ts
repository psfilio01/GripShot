import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { resolve } from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@fashionmentum/workflow-core"],
  outputFileTracingRoot: resolve(__dirname, "../../"),
};

export default withNextIntl(nextConfig);
