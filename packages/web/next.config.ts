import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@fashionmentum/workflow-core"],
  outputFileTracingRoot: resolve(__dirname, "../../"),
};

export default nextConfig;
