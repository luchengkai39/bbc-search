import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Trace from the pnpm workspace root so Netlify Functions resolve `next`.
  outputFileTracingRoot: path.join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
};

export default nextConfig;
