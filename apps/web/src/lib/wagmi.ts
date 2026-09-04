import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "@wagmi/connectors";
import { defineChain } from "viem";
import {
  CREDITCOIN_CHAIN_ID,
  CREDITCOIN_EXPLORER,
  CREDITCOIN_RPC,
} from "@/config/networks";

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";
const creditcoinRpc = process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? CREDITCOIN_RPC;

export const creditcoin = defineChain({
  id: CREDITCOIN_CHAIN_ID,
  name: "Creditcoin CC3 Testnet",
  nativeCurrency: { name: "Testnet CTC", symbol: "tCTC", decimals: 18 },
  rpcUrls: {
    default: { http: [creditcoinRpc] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: CREDITCOIN_EXPLORER },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [sepolia, creditcoin],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [creditcoin.id]: http(creditcoinRpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
