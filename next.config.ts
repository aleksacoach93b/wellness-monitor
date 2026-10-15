import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local builds inside this checkout even when a parent has a lockfile.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
