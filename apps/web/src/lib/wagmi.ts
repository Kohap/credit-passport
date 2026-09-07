"use client";

import { createConfig } from "wagmi";
import { injected } from "@wagmi/core";
import { sepolia as sepoliaCatalog } from "wagmi/chains";
import { fallback, http, type Chain } from "viem";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_RPC,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_RPCS,
} from "@/config/networks";

export const creditcoinTestnet = {
  id: CREDITCOIN_CHAIN_ID,
  name: "Creditcoin CC3 Testnet",
  nativeCurrency: { name: "tCTC", symbol: "tCTC", decimals: 18 },
  rpcUrls: {
    default: { http: [CREDITCOIN_RPC] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://creditcoin-testnet.blockscout.com",
    },
  },
  testnet: true,
} as const satisfies Chain;

export const sepolia = {
  ...sepoliaCatalog,
  rpcUrls: {
    default: { http: [...SEPOLIA_RPCS] as [string, ...string[]] },
  },
} as const satisfies Chain;

export const wagmiConfig = createConfig({
  chains: [sepolia, creditcoinTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [SEPOLIA_CHAIN_ID]: fallback(
      SEPOLIA_RPCS.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
    ),
    [CREDITCOIN_CHAIN_ID]: http(CREDITCOIN_RPC, { timeout: 20_000 }),
  },
  ssr: true,
});
