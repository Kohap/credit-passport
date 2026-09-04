import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@x402/evm": false,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
      "@solana/kit": false,
      "@solana-program/token": false,
      "@solana-program/system": false,
    };
    return config;
  },
};

export default nextConfig;
