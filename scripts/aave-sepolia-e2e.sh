#!/usr/bin/env bash
# Produce a real Aave V3 Sepolia variable-debt full repayment for the Aave Passport alpha.
# It mints public test assets, supplies DAI collateral, borrows USDC, then repays with Aave's max sentinel.
# Usage: bash scripts/aave-sepolia-e2e.sh
set -euo pipefail

CHECK_ONLY=false
case "${1:-}" in
  --check) CHECK_ONLY=true ;;
  "") ;;
  *) echo "Usage: bash scripts/aave-sepolia-e2e.sh [--check]" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example, set SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY, then retry." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL in .env}"
: "${SEPOLIA_PRIVATE_KEY:?Set SEPOLIA_PRIVATE_KEY in .env}"
if [[ ! "$SEPOLIA_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: SEPOLIA_PRIVATE_KEY must be a 0x-prefixed 32-byte private key." >&2
  exit 1
fi

# Official Aave V3 Sepolia address book values.
AAVE_V3_SEPOLIA_POOL="${AAVE_V3_SEPOLIA_POOL:-0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951}"
AAVE_SEPOLIA_FAUCET="${AAVE_SEPOLIA_FAUCET:-0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D}"
AAVE_SEPOLIA_DAI="${AAVE_SEPOLIA_DAI:-0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357}"
AAVE_SEPOLIA_USDC="${AAVE_SEPOLIA_USDC:-0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8}"
DAI_COLLATERAL=1000000000000000000000
USDC_BORROW=1000000
USDC_ALLOWANCE=110000000
MAX_UINT256=0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
ACCOUNT="$(cast wallet address --private-key "$SEPOLIA_PRIVATE_KEY")"
RPC=(--rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY")

send() {
  local receipt
  receipt="$(cast send "$@" "${RPC[@]}" --json)"
  node -e 'const r=JSON.parse(process.argv[1]);if(BigInt(r.status)!==1n) throw new Error("Transaction reverted; stop and inspect the previous step");console.log(JSON.stringify(r));' "$receipt"
}

if [[ "$(cast chain-id --rpc-url "$SEPOLIA_RPC_URL")" != 11155111 ]]; then
  echo "ERROR: refusing to transact outside Sepolia." >&2
  exit 1
fi
if [[ "$(cast call "$AAVE_SEPOLIA_DAI" 'decimals()(uint8)' --rpc-url "$SEPOLIA_RPC_URL")" != 18 || \
      "$(cast call "$AAVE_SEPOLIA_USDC" 'decimals()(uint8)' --rpc-url "$SEPOLIA_RPC_URL")" != 6 ]]; then
  echo "ERROR: unexpected asset decimals; no transactions sent." >&2
  exit 1
fi
ACCOUNT_DATA="$(cast call "$AAVE_V3_SEPOLIA_POOL" \
  'getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)' "$ACCOUNT" \
  --rpc-url "$SEPOLIA_RPC_URL" --json)"
node -e 'const values=JSON.parse(process.argv[1]); if(BigInt(values[1])!==0n) {console.error("Existing Aave debt detected. Use a debt-free test wallet; no transactions sent.");process.exit(1);}' "$ACCOUNT_DATA"

echo "==> Aave V3 Sepolia full-repayment run for $ACCOUNT"
echo "==> Check whether the public pool currently accepts this collateral"
if ! PREFLIGHT="$(cast call "$AAVE_V3_SEPOLIA_POOL" \
  "supply(address,uint256,address,uint16)" "$AAVE_SEPOLIA_DAI" "$DAI_COLLATERAL" "$ACCOUNT" 0 \
  --from "$ACCOUNT" --rpc-url "$SEPOLIA_RPC_URL" 2>&1)"; then
  if [[ "$PREFLIGHT" == *'Error("51")'* || "$PREFLIGHT" == *'execution reverted: 51'* ]]; then
    echo "Aave V3 Sepolia's DAI supply cap is currently full. No source transaction was sent." >&2
    echo "Wait for public pool capacity. Do not rerun with arbitrary token addresses." >&2
    exit 2
  fi
  # Only known funding/allowance failures can be resolved by the writes below.
  if [[ "$PREFLIGHT" != *'ERC20: insufficient allowance'* && "$PREFLIGHT" != *'ERC20: transfer amount exceeds balance'* ]]; then
    echo "ERROR: pool preflight failed. Resolve the RPC or contract error before retrying; no transactions sent." >&2
    exit 1
  fi
fi
if [[ "$CHECK_ONLY" == true ]]; then
  echo "Read-only preflight completed. No transactions sent; borrowing has not been simulated."
  exit 0
fi
echo "==> Mint test DAI collateral and a small USDC repayment buffer"
send "$AAVE_SEPOLIA_FAUCET" "mint(address,address,uint256)" "$AAVE_SEPOLIA_DAI" "$ACCOUNT" "$DAI_COLLATERAL"
send "$AAVE_SEPOLIA_FAUCET" "mint(address,address,uint256)" "$AAVE_SEPOLIA_USDC" "$ACCOUNT" "$USDC_ALLOWANCE"

echo "==> Supply 1,000 DAI collateral and borrow 1 USDC variable debt"
send "$AAVE_SEPOLIA_DAI" "approve(address,uint256)" "$AAVE_V3_SEPOLIA_POOL" "$DAI_COLLATERAL"
send "$AAVE_V3_SEPOLIA_POOL" "supply(address,uint256,address,uint16)" "$AAVE_SEPOLIA_DAI" "$DAI_COLLATERAL" "$ACCOUNT" 0
send "$AAVE_V3_SEPOLIA_POOL" "borrow(address,uint256,uint256,uint16,address)" "$AAVE_SEPOLIA_USDC" "$USDC_BORROW" 2 0 "$ACCOUNT"
send "$AAVE_SEPOLIA_USDC" "approve(address,uint256)" "$AAVE_V3_SEPOLIA_POOL" "$USDC_ALLOWANCE"

echo "==> Repay all variable USDC debt using Aave's full-close sentinel"
REPAY_OUT="$(send "$AAVE_V3_SEPOLIA_POOL" "repay(address,uint256,uint256,address)" "$AAVE_SEPOLIA_USDC" "$MAX_UINT256" 2 "$ACCOUNT")"
echo "$REPAY_OUT"
REPAY_TX="$(node -e 'const r=JSON.parse(process.argv[1]);if(BigInt(r.status)!==1n) throw new Error("Repayment reverted");console.log(r.transactionHash);' "$REPAY_OUT")"
if [[ ! "$REPAY_TX" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: could not read repayment transaction hash from cast output." >&2
  exit 1
fi

send "$AAVE_SEPOLIA_USDC" "approve(address,uint256)" "$AAVE_V3_SEPOLIA_POOL" 0

cat <<EOF

======== AAVE REPAYMENT SOURCE ========
Sepolia Aave Pool: $AAVE_V3_SEPOLIA_POOL
Sepolia full-repayment tx: https://sepolia.etherscan.io/tx/$REPAY_TX
Borrower: $ACCOUNT

After the block attests, run:
npm run prove -- $REPAY_TX --aave --submit --claim $ACCOUNT
========================================
EOF
