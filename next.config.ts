import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "dkdmigarmmsnddifyoaq.supabase.co" }],
  },
};

export default nextConfig;
