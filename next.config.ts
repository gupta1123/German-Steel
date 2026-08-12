import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow remote images used on the login page
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
