import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "dkdmigarmmsnddifyoaq.supabase.co" }],
  },
};

export default nextConfig;
