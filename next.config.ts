import type { NextConfig } from "next";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth/).*)",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;