import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for multi-zone: ensures JS/CSS assets load from the correct
  // origin when this app is proxied through calbliss.vercel.app/dashboard
  assetPrefix: "https://greek-barber-final.vercel.app",
};

export default nextConfig;
