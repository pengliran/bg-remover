import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 兼容
  output: "standalone",
};

export default nextConfig;
