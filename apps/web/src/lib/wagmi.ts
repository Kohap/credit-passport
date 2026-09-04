"use client";

import { http, createConfig } from "wagmi";
import { injected } from "@wagmi/core";
import { sepolia } from "wagmi/chains";
import type { Chain } from "viem";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_RPC,
  SEPOLIA_CHAIN_ID,
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

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia, creditcoinTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [SEPOLIA_CHAIN_ID]: http(sepoliaRpc),
    [CREDITCOIN_CHAIN_ID]: http(CREDITCOIN_RPC),
  },
  ssr: true,
});
