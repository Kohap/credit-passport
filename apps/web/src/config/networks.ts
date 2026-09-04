export const SEPOLIA_CHAIN_ID = 11155111;
export const CREDITCOIN_CHAIN_ID = 102031;
export const SEPOLIA_CHAIN_KEY = 1;

export const CREDITCOIN_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
export const CREDITCOIN_EXPLORER = "https://creditcoin-testnet.blockscout.com";
export const ATTESTOR_DASHBOARD = "https://dashboard.cc3-testnet.creditcoin.network";
export const PROOF_BUILDER_URL = "https://prover.cc3-testnet.creditcoin.network";

/** Fill after deploy — also overridable via NEXT_PUBLIC_* env. */
export const addresses = {
  sepoliaMockUsd:
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_USD ?? "0x0000000000000000000000000000000000000000",
  sepoliaMockMarket:
    process.env.NEXT_PUBLIC_SEPOLIA_MOCK_MARKET ?? "0x0000000000000000000000000000000000000000",
  creditPassportAsc:
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_ASC ??
    "0x0000000000000000000000000000000000000000",
  creditScore:
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_SCORE ??
    "0x0000000000000000000000000000000000000000",
  creditLine:
    process.env.NEXT_PUBLIC_CREDITCOIN_CREDIT_LINE ??
    "0x0000000000000000000000000000000000000000",
  passportNft:
    process.env.NEXT_PUBLIC_CREDITCOIN_PASSPORT_NFT ??
    "0x0000000000000000000000000000000000000000",
  creditMockUsd:
    process.env.NEXT_PUBLIC_CREDITCOIN_MOCK_USD ??
    "0x0000000000000000000000000000000000000000",
} as const;

export const SCORE_FORMULA = [
  "+40 first verified repayment",
  "+20 each additional verified repayment",
  "+10 if remainingDebt == 0 (loan closed)",
  "score capped at 100",
  "borrowCap = 100 mUSD + (score × 2 mUSD)",
] as const;
