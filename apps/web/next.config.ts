import type { NextConfig } from "next";

/** GitHub Pages serves the site at https://<user>.github.io/credit-passport/ */
const isGithubPages = process.env.GITHUB_PAGES === "true";

function safePublicOrigin(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  const url = new URL(candidate);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Public service URLs must use HTTPS and cannot include credentials.");
  }
  return url.origin;
}

const connectSources = Array.from(
  new Set([
    "'self'",
    safePublicOrigin(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
      "https://ethereum-sepolia-rpc.publicnode.com",
    ),
    safePublicOrigin(
      process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL,
      "https://rpc.cc3-testnet.creditcoin.network",
    ),
    safePublicOrigin(
      process.env.NEXT_PUBLIC_PROOF_BUILDER_URL,
      "https://prover.cc3-testnet.creditcoin.network",
    ),
    safePublicOrigin(
      process.env.NEXT_PUBLIC_PROOF_BUILDER_URL_FALLBACK,
      "https://proof-gen-api.cc3-testnet.creditcoin.network",
    ),
    "https://1rpc.io",
    "https://rpc.sepolia.ethpandaops.io",
    "https://sepolia.gateway.tenderly.co",
  ]),
).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `connect-src ${connectSources}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/credit-passport",
        assetPrefix: "/credit-passport/",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
  ...(!isGithubPages
    ? {
        async rewrites() {
          return [
            {
              source: "/api/prover/api/v1/attested-height/:chainKey",
              destination:
                "https://prover.cc3-testnet.creditcoin.network/api/v1/attested-height/:chainKey",
            },
            {
              source: "/api/prover/api/v1/proof-by-tx/:chainKey/:txHash",
              destination:
                "https://prover.cc3-testnet.creditcoin.network/api/v1/proof-by-tx/:chainKey/:txHash",
            },
            {
              source: "/api/prover-fallback/api/v1/attested-height/:chainKey",
              destination:
                "https://proof-gen-api.cc3-testnet.creditcoin.network/api/v1/attested-height/:chainKey",
            },
            {
              source: "/api/prover-fallback/api/v1/proof-by-tx/:chainKey/:txHash",
              destination:
                "https://proof-gen-api.cc3-testnet.creditcoin.network/api/v1/proof-by-tx/:chainKey/:txHash",
            },
          ];
        },
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
