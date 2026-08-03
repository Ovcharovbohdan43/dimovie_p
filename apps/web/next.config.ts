import type { NextConfig } from "next";
import path from "path";

function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  // Avoid Windows resolving localhost to ::1 while API listens on IPv4
  return raw.replace("://localhost", "://127.0.0.1");
}

const apiUrl = resolveApiUrl();
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Monorepo root so Turbopack resolves hoisted workspace deps
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "vumbnail.com", pathname: "/**" },
      { protocol: "https", hostname: "i.vimeocdn.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
