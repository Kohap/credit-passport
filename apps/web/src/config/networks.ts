export const SEPOLIA_CHAIN_ID = 11155111;
export const CREDITCOIN_CHAIN_ID = 102031;
export const SEPOLIA_CHAIN_KEY = 1;

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
export const CREDITCOIN_EXPLORER = "https://creditcoin-testnet.blockscout.com";
export const ATTESTOR_DASHBOARD = "https://dashboard.cc3-testnet.creditcoin.network";
/** Public demo URLs. */
export const DESK_URL = "https://web-mauve-five-21.vercel.app/";
export const PAGES_URL = "https://kohap.github.io/credit-passport/";
export const ASC_DEFAULT = "0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb";

/** Prefer NEXT_PUBLIC_* when non-empty; empty strings must not wipe baked defaults (Pages/CI). */
function pub(envVal: string | undefined, fallback: string): string {
  const v = envVal?.trim();
  return v ? v : fallback;
}

function publicHttpsUrl(envVal: string | undefined, fallback: string): string {
  const value = pub(envVal, fallback);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("must use HTTPS without credentials");
    }
    return url.toString().replace(/\/$/, "");
  } catch (error) {
    throw new Error(
      `Invalid public URL configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function publicAddress(envVal: string | undefined, fallback: string): string {
  const value = pub(envVal, fallback);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error("Invalid public contract address configuration.");
  }
  return value;
}

function isDeadSepoliaRpc(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "rpc2.sepolia.org" || host === "rpc.sepolia.org";
  } catch {
    return true;
  }
}

const PUBLIC_SEPOLIA = "https://ethereum-sepolia-rpc.publicnode.com";
const envSepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim();

export const SEPOLIA_RPC =
  envSepoliaRpc && !isDeadSepoliaRpc(envSepoliaRpc)
    ? publicHttpsUrl(envSepoliaRpc, PUBLIC_SEPOLIA)
    : PUBLIC_SEPOLIA;

export const CREDITCOIN_RPC = publicHttpsUrl(
  process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL,
  "https://rpc.cc3-testnet.creditcoin.network",
);

export const PROOF_BUILDER_URL = publicHttpsUrl(
  process.env.NEXT_PUBLIC_PROOF_BUILDER_URL,
  "https://prover.cc3-testnet.creditcoin.network",
);

export const PROOF_BUILDER_URL_FALLBACK = publicHttpsUrl(
  process.env.NEXT_PUBLIC_PROOF_BUILDER_URL_FALLBACK,
  "https://proof-gen-api.cc3-testnet.creditcoin.network",
);

export const SEPOLIA_RPCS: readonly string[] = [
  SEPOLIA_RPC,
  PUBLIC_SEPOLIA,
  "https://1rpc.io/sepolia",
  "https://rpc.sepolia.ethpandaops.io",
  "https://sepolia.gateway.tenderly.co",
].filter((url, i, arr) => arr.indexOf(url) === i);

/** Live CC3 / Sepolia demo deploys — overridable via NEXT_PUBLIC_* env. */
export const addresses = {
  sepoliaMockUsd: publicAddress(
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_USD,
    "0x5D695DD7bd61D22731973F32e84c8D797FEed701",
  ),
  sepoliaMockMarket: publicAddress(
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_MARKET,
    "0xEd2a52496044771bE1a3583f2d7061da33427a6a",
  ),
  creditPassportAsc: publicAddress(
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_ASC,
    "0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb",
  ),
  creditScore: publicAddress(
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_SCORE,
    "0xEd2a52496044771bE1a3583f2d7061da33427a6a",
  ),
  creditLine: publicAddress(
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_LINE,
    "0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e",
  ),
  passportNft: publicAddress(
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_NFT,
    "0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e",
  ),
  creditMockUsd: publicAddress(
    process.env.NEXT_PUBLIC_CREDITCOIN_MOCK_USD,
    "0x5D695DD7bd61D22731973F32e84c8D797FEed701",
  ),
} as const;

export const SCORE_FORMULA = [
  "+50 first verified closed repayment",
  "+30 each additional verified closed repayment",
  "each borrower/loan pair is credited once",
  "score capped at 100",
  "borrowCap = 100 mUSD + (score × 2 mUSD)",
] as const;
