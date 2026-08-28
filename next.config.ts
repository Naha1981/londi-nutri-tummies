import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for the sandbox's self-hosted runtime;
  // Vercel manages its own build output, so skip it there.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
