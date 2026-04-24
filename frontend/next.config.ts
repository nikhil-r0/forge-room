// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Next.js dynamic property
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "10.42.0.132:3000", "10.42.0.132"],
  experimental: {
  },
  // Correct way to handle CORS
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
