import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],
  transpilePackages: ["motion"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // T11/T12 (plan/05): WASM threads need cross-origin isolation, but the
  // headers go ONLY on the craft paths. Site-wide COOP/COEP would break
  // Google sign-in popups and Maps. The plan pins these headers on
  // /craft/*, the craft editor page and /studio/render. CORP same-origin
  // accompanies COEP require-corp so the same-origin app files keep
  // loading. Note the editor route segment is [id] in this repo (the
  // plan's [designId] is the same route under the plan's name), so both
  // source patterns are listed. Spike note 2026-11-12: FilmCraft's H.264
  // encoder does need a thread pool (SharedArrayBuffer), which is only
  // available on an isolated page — isolation is required, not optional,
  // on craft paths.
  async headers() {
    const craftHeaders = [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];
    return [
      { source: "/craft/:path*", headers: craftHeaders },
      { source: "/studio/designs/:designId/craft/:app", headers: craftHeaders },
      { source: "/studio/designs/:id/craft/:app", headers: craftHeaders },
      { source: "/studio/render", headers: craftHeaders },
    ];
  },
};

export default nextConfig;
