#!/usr/bin/env bash
# End-to-end Sepolia repay → Attestcoin prove → Creditcoin submit.
# Requires .env with SEPOLIA_* and CREDITCOIN_* keys + RPCs.
#
# Usage:
#   set -a && source .env && set +a
#   bash scripts/demo-e2e.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${SEPOLIA_RPC_URL:?}"
: "${SEPOLIA_PRIVATE_KEY:?}"
: "${CREDITCOIN_RPC_URL:?}"
: "${CREDITCOIN_PRIVATE_KEY:?}"

SEPOLIA_MOCK_USD="${SEPOLIA_MOCK_USD:-0x5D695DD7bd61D22731973F32e84c8D797FEed701}"
SEPOLIA_MOCK_MARKET="${SEPOLIA_MOCK_MARKET:-0xEd2a52496044771bE1a3583f2d7061da33427a6a}"
AMOUNT_WEI=100000000000000000000 # 100 mUSD

ADDR="$(cast wallet address --private-key "$SEPOLIA_PRIVATE_KEY")"
echo "==> Demo wallet: $ADDR"
echo "==> Sepolia ETH: $(cast balance "$ADDR" --rpc-url "$SEPOLIA_RPC_URL")"
echo "==> Creditcoin tCTC: $(cast balance "$ADDR" --rpc-url "$CREDITCOIN_RPC_URL")"

echo "==> Faucet mUSD (Sepolia)"
cast send "$SEPOLIA_MOCK_USD" "faucet()" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" || true

echo "==> Open loan 100 mUSD"
OPEN_OUT="$(cast send "$SEPOLIA_MOCK_MARKET" "openLoan(uint256)" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" --json)"
echo "$OPEN_OUT" | head -c 400; echo

# loanId: read nextLoanId - 1
NEXT="$(cast call "$SEPOLIA_MOCK_MARKET" "nextLoanId()(uint256)" --rpc-url "$SEPOLIA_RPC_URL")"
LOAN_ID=$((NEXT - 1))
echo "==> Using loanId=$LOAN_ID"

echo "==> Approve + repay"
cast send "$SEPOLIA_MOCK_USD" "approve(address,uint256)" "$SEPOLIA_MOCK_MARKET" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY"
REPAY_HASH="$(cast send "$SEPOLIA_MOCK_MARKET" "repay(uint256,uint256)" "$LOAN_ID" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" --json | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash',''))")"
echo "==> Sepolia repay tx: $REPAY_HASH"
echo "    https://sepolia.etherscan.io/tx/$REPAY_HASH"

echo "==> Fund CreditLine liquidity (best-effort)"
bash scripts/fund-creditline.sh 1000000 || true

echo "==> Attestcoin prove + submit"
export CREDITCOIN_PASSPORT_ASC="${CREDITCOIN_PASSPORT_ASC:-0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb}"
npm run prove -- "$REPAY_HASH" --submit --claim "$ADDR" --json-out /tmp/credit-passport-proof.json

echo ""
echo "RUN THIS after setting .env — done. Paste HACKATHON PROOF block into README."
echo "Sepolia LoanRepaid tx: $REPAY_HASH"
