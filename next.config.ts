import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TODO(backend-integration): replace with real CDN / product-image
    // domains once product images are served from the database.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
