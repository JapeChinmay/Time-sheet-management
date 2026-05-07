import type { NextConfig } from "next";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth/signin|auth/signout|auth/session|auth/providers|auth/callback|auth/csrf).*)",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;