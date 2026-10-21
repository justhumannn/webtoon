import type { NextConfig } from "next";

// 개발할 때만 쓰는 백엔드 주소. 운영에서는 Nginx 가 /api 를 백엔드로 바로 보내므로 이 rewrite 까지 오지 않는다.
const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Docker 이미지를 작게 만들기 위해 실행에 필요한 파일만 .next/standalone 으로 모은다.
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
