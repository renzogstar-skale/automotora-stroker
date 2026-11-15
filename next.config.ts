import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renderizado dinámico clásico: el panel siempre lee datos frescos de la base.
  cacheComponents: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-lib"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
