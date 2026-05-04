import type { NextConfig } from "next";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://3.108.234.187:3000/:path*`,
      },
    ];
  },
};

export default nextConfig;