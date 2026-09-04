export const SEPOLIA_CHAIN_ID = 11155111;
export const CREDITCOIN_CHAIN_ID = 102031;
export const SEPOLIA_CHAIN_KEY = 1;

export const CREDITCOIN_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
export const CREDITCOIN_EXPLORER = "https://creditcoin-testnet.blockscout.com";
export const ATTESTOR_DASHBOARD = "https://dashboard.cc3-testnet.creditcoin.network";
export const PROOF_BUILDER_URL = "https://prover.cc3-testnet.creditcoin.network";
export const PROOF_BUILDER_URL_FALLBACK =
  "https://proof-gen-api.cc3-testnet.creditcoin.network";
/** Public demo URLs. */
export const DESK_URL = "https://web-mauve-five-21.vercel.app/";
export const PAGES_URL = "https://kohap.github.io/credit-passport/";
export const ASC_DEFAULT = "0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb";

/** Prefer NEXT_PUBLIC_* when non-empty; empty strings must not wipe baked defaults (Pages/CI). */
function pub(envVal: string | undefined, fallback: string): string {
  const v = envVal?.trim();
  return v ? v : fallback;
}

/** Live CC3 / Sepolia demo deploys — overridable via NEXT_PUBLIC_* env. */
export const addresses = {
  sepoliaMockUsd: pub(
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_USD,
    "0x5D695DD7bd61D22731973F32e84c8D797FEed701",
  ),
  sepoliaMockMarket: pub(
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_MARKET,
    "0xEd2a52496044771bE1a3583f2d7061da33427a6a",
  ),
  creditPassportAsc: pub(
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_ASC,
    "0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb",
  ),
  creditScore: pub(
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_SCORE,
    "0xEd2a52496044771bE1a3583f2d7061da33427a6a",
  ),
  creditLine: pub(
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_LINE,
    "0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e",
  ),
  passportNft: pub(
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_NFT,
    "0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e",
  ),
  creditMockUsd: pub(
    process.env.NEXT_PUBLIC_CREDITCOIN_MOCK_USD,
    "0x5D695DD7bd61D22731973F32e84c8D797FEed701",
  ),
} as const;

export const SCORE_FORMULA = [
  "+40 first verified repayment",
  "+20 each additional verified repayment",
  "+10 if remainingDebt == 0 (loan closed)",
  "score capped at 100",
  "borrowCap = 100 mUSD + (score × 2 mUSD)",
] as const;
