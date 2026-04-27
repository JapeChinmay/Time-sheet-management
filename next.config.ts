import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://nexus-project-suite.onrender.com/:path*",
      },
    ];
  },
};


// destination: "http://localhost:3001/:path*",

export default nextConfig;