#!/usr/bin/env bash
# End-to-end Sepolia repay → Attestcoin prove → Creditcoin submit.
# Requires .env with SEPOLIA_* and CREDITCOIN_* keys + RPCs.
# Same EOA on both chains (ASC BorrowerMismatch otherwise).
#
# Usage:
#   set -a && source .env && set +a
#   bash scripts/demo-e2e.sh
#
# After success: paste HACKATHON PROOF into README, hit record same hour.
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
PROOF_JSON="${PROOF_JSON:-/tmp/credit-passport-proof.json}"
PROOF_LOG="${PROOF_LOG:-/tmp/credit-passport-hackathon-proof.txt}"

ADDR="$(cast wallet address --private-key "$SEPOLIA_PRIVATE_KEY")"
echo "==> Demo wallet: $ADDR"
echo "==> Sepolia ETH: $(cast balance "$ADDR" --rpc-url "$SEPOLIA_RPC_URL")"
echo "==> Creditcoin tCTC: $(cast balance "$ADDR" --rpc-url "$CREDITCOIN_RPC_URL")"

echo "==> Ensure MockMarket has mUSD inventory (openLoan pulls from market)"
cast send "$SEPOLIA_MOCK_USD" "mint(address,uint256)" "$SEPOLIA_MOCK_MARKET" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" || true

echo "==> Faucet mUSD to borrower (for repay)"
cast send "$SEPOLIA_MOCK_USD" "faucet()" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" || true

echo "==> Open loan 100 mUSD"
cast send "$SEPOLIA_MOCK_MARKET" "openLoan(uint256)" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY"

NEXT="$(cast call "$SEPOLIA_MOCK_MARKET" "nextLoanId()(uint256)" --rpc-url "$SEPOLIA_RPC_URL")"
LOAN_ID=$((NEXT - 1))
echo "==> Using loanId=$LOAN_ID"

echo "==> Approve + repay (emits LoanRepaid)"
cast send "$SEPOLIA_MOCK_USD" "approve(address,uint256)" "$SEPOLIA_MOCK_MARKET" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY"
REPAY_HASH="$(cast send "$SEPOLIA_MOCK_MARKET" "repay(uint256,uint256)" "$LOAN_ID" "$AMOUNT_WEI" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY" --json | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash',''))")"
if [[ -z "$REPAY_HASH" || "$REPAY_HASH" == "None" ]]; then
  echo "ERROR: could not parse repay tx hash" >&2
  exit 1
fi
echo "==> Sepolia LoanRepaid tx: $REPAY_HASH"
echo "    https://sepolia.etherscan.io/tx/$REPAY_HASH"

echo "==> Fund CreditLine liquidity on CC3 (best-effort)"
bash scripts/fund-creditline.sh 1000000 || true

echo "==> Attestcoin prove + submit (can take minutes while height attests)"
export CREDITCOIN_PASSPORT_ASC="${CREDITCOIN_PASSPORT_ASC:-0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb}"
set +e
npm run prove -- "$REPAY_HASH" --submit --claim "$ADDR" --json-out "$PROOF_JSON" 2>&1 | tee "$PROOF_LOG"
PROVE_RC=${PIPESTATUS[0]}
set -e

echo ""
echo "======== NEXT (judges) ========"
echo "1. Open explorers from the HACKATHON PROOF block above (also in $PROOF_LOG)."
echo "2. Paste into README:"
echo "     Sepolia LoanRepaid tx:  https://sepolia.etherscan.io/tx/$REPAY_HASH"
echo "     Creditcoin proveRepayment tx: <from HACKATHON PROOF>"
echo "     Passport tokenId: cast call \$CREDITCOIN_PASSPORT_NFT \"tokenOf(address)(uint256)\" $ADDR --rpc-url \$CREDITCOIN_RPC_URL"
echo "3. Hit record THIS HOUR (CLI window + explorer tabs)."
echo "4. Flat proof JSON (CORS paste): $PROOF_JSON"
echo "================================"
exit "$PROVE_RC"
