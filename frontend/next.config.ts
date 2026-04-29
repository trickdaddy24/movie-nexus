import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "@prisma/client", "@prisma/engines"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "assets.fanart.tv" },
      { protocol: "https", hostname: "webservice.fanart.tv" },
    ],
  },
};

export default nextConfig;
