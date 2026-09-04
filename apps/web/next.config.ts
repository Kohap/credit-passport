import type { NextConfig } from "next";

/** GitHub Pages serves the site at https://<user>.github.io/credit-passport/ */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/credit-passport",
        assetPrefix: "/credit-passport/",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@x402/evm": false,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
      "@solana/kit": false,
      "@solana-program/token": false,
      "@solana-program/system": false,
      // Browser / static export: Node builtins unused by client prove path
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
