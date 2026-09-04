#!/usr/bin/env bash
# Mint MockUSD on Creditcoin into CreditLine so Borrow works in the demo.
# Requires CREDITCOIN_PRIVATE_KEY of the MockUSD owner (demo deployer).
#
# Usage:
#   set -a && source .env && set +a
#   bash scripts/fund-creditline.sh
#   # optional amount in whole mUSD (default 1000000):
#   bash scripts/fund-creditline.sh 1000000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${CREDITCOIN_RPC_URL:?Set CREDITCOIN_RPC_URL in .env}"
: "${CREDITCOIN_PRIVATE_KEY:?Set CREDITCOIN_PRIVATE_KEY in .env}"

CREDITCOIN_MOCK_USD="${CREDITCOIN_MOCK_USD:-0x5D695DD7bd61D22731973F32e84c8D797FEed701}"
CREDITCOIN_CREDIT_LINE="${CREDITCOIN_CREDIT_LINE:-0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e}"
AMOUNT_WHOLE="${1:-1000000}"
# 1e18 * amount
AMOUNT_WEI="$(python3 -c "print(int(${AMOUNT_WHOLE}) * 10**18)")"

ADDR="$(cast wallet address --private-key "$CREDITCOIN_PRIVATE_KEY")"
echo "==> Funder: $ADDR"
echo "==> Mint ${AMOUNT_WHOLE} mUSD → CreditLine ${CREDITCOIN_CREDIT_LINE}"

cast send "$CREDITCOIN_MOCK_USD" \
  "mint(address,uint256)" \
  "$CREDITCOIN_CREDIT_LINE" \
  "$AMOUNT_WEI" \
  --rpc-url "$CREDITCOIN_RPC_URL" \
  --private-key "$CREDITCOIN_PRIVATE_KEY" \
  --legacy

BAL="$(cast call "$CREDITCOIN_MOCK_USD" "balanceOf(address)(uint256)" "$CREDITCOIN_CREDIT_LINE" --rpc-url "$CREDITCOIN_RPC_URL")"
echo "==> CreditLine MockUSD balance (wei): $BAL"
