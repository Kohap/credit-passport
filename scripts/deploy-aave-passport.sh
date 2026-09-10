#!/usr/bin/env bash
# Deploy an isolated Credit Passport alpha that accepts only full Aave V3 Sepolia variable-debt repayments.
# The proven v2 MockMarket deployment is untouched.
# Usage: bash scripts/deploy-aave-passport.sh --deploy
set -euo pipefail

if [[ "${1:-}" != --deploy ]]; then
  echo "Read docs/AAVE_ALPHA.md and reconcile any previous deployment first."
  echo "To explicitly create a NEW isolated stack: bash scripts/deploy-aave-passport.sh --deploy"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example, set the funded testnet keys, then retry." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${CREDITCOIN_RPC_URL:?Set CREDITCOIN_RPC_URL in .env}"
: "${CREDITCOIN_PRIVATE_KEY:?Set CREDITCOIN_PRIVATE_KEY in .env}"
: "${CREDITCOIN_MOCK_USD:?Set CREDITCOIN_MOCK_USD to the v2 Creditcoin MockUSD address}"

if [[ ! "$CREDITCOIN_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: CREDITCOIN_PRIVATE_KEY must be a 0x-prefixed 32-byte private key." >&2
  exit 1
fi

# Official Aave address book: AaveV3Sepolia.POOL.
AAVE_V3_SEPOLIA_POOL="${AAVE_V3_SEPOLIA_POOL:-0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951}"
DEPLOYER="$(cast wallet address --private-key "$CREDITCOIN_PRIVATE_KEY")"
if [[ "$(cast chain-id --rpc-url "$CREDITCOIN_RPC_URL")" != 102031 ]]; then
  echo "ERROR: refusing to deploy outside Creditcoin CC3 testnet." >&2
  exit 1
fi
if [[ "$(cast code "$CREDITCOIN_MOCK_USD" --rpc-url "$CREDITCOIN_RPC_URL")" == 0x ]]; then
  echo "ERROR: configured demo asset has no code." >&2
  exit 1
fi
CREATE=(forge create --broadcast --json --rpc-url "$CREDITCOIN_RPC_URL" --private-key "$CREDITCOIN_PRIVATE_KEY" --legacy)

echo "==> Aave repayment alpha owner: $DEPLOYER"
echo "==> Trusted Sepolia Aave V3 Pool: $AAVE_V3_SEPOLIA_POOL"
echo "==> Creditcoin demo asset: $CREDITCOIN_MOCK_USD"

deploy() {
  local label="$1" contract="$2"
  shift 2
  echo "==> Deploy $label"
  local output
  output="$(cd packages/contracts-creditcoin && "${CREATE[@]}" "$contract" --constructor-args "$@")"
  echo "$output"
  DEPLOYED_ADDRESS="$(node -e 'const r=JSON.parse(process.argv[1]);console.log(r.deployedTo);' "$output")"
  if [[ ! "$DEPLOYED_ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "ERROR: failed to parse $label address from forge create output." >&2
    exit 1
  fi
}

deploy CreditScore src/CreditScore.sol:CreditScore "$DEPLOYER"
CREDITCOIN_AAVE_CREDIT_SCORE="$DEPLOYED_ADDRESS"
deploy CreditLine src/CreditLine.sol:CreditLine "$CREDITCOIN_MOCK_USD" "$DEPLOYER"
CREDITCOIN_AAVE_CREDIT_LINE="$DEPLOYED_ADDRESS"
deploy PassportNFT src/PassportNFT.sol:PassportNFT "$DEPLOYER"
CREDITCOIN_AAVE_PASSPORT_NFT="$DEPLOYED_ADDRESS"
deploy AaveV3RepaymentASC src/AaveV3RepaymentASC.sol:AaveV3RepaymentASC \
  "$AAVE_V3_SEPOLIA_POOL" "$CREDITCOIN_AAVE_CREDIT_SCORE" "$CREDITCOIN_AAVE_CREDIT_LINE" "$CREDITCOIN_AAVE_PASSPORT_NFT"
CREDITCOIN_AAVE_PASSPORT_ASC="$DEPLOYED_ADDRESS"

for key in CREDITCOIN_AAVE_CREDIT_SCORE CREDITCOIN_AAVE_CREDIT_LINE CREDITCOIN_AAVE_PASSPORT_NFT CREDITCOIN_AAVE_PASSPORT_ASC; do
  value="${!key}"
  if [[ ! "$value" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "ERROR: failed to parse $key from forge create output." >&2
    exit 1
  fi
done

RPC=(--rpc-url "$CREDITCOIN_RPC_URL" --private-key "$CREDITCOIN_PRIVATE_KEY" --legacy)
send() {
  local receipt
  receipt="$(cast send "$@" "${RPC[@]}" --json)"
  node -e 'const r=JSON.parse(process.argv[1]);if(BigInt(r.status)!==1n) throw new Error("Deployment setup transaction reverted");console.log(JSON.stringify(r));' "$receipt"
}
echo "==> Grant the ASC its narrowly scoped writer roles"
send "$CREDITCOIN_AAVE_CREDIT_SCORE" "setWriter(address)" "$CREDITCOIN_AAVE_PASSPORT_ASC"
send "$CREDITCOIN_AAVE_CREDIT_LINE" "setUpdater(address)" "$CREDITCOIN_AAVE_PASSPORT_ASC"
send "$CREDITCOIN_AAVE_PASSPORT_NFT" "setMinter(address)" "$CREDITCOIN_AAVE_PASSPORT_ASC"

echo "==> Seed alpha CreditLine with 1,000 mUSD"
send "$CREDITCOIN_MOCK_USD" "mint(address,uint256)" "$CREDITCOIN_AAVE_CREDIT_LINE" 1000000000000000000000

cat <<EOF

==> Aave repayment alpha deployed. Add these to local .env after checking explorer transactions:

AAVE_V3_SEPOLIA_POOL=$AAVE_V3_SEPOLIA_POOL
CREDITCOIN_AAVE_CREDIT_SCORE=$CREDITCOIN_AAVE_CREDIT_SCORE
CREDITCOIN_AAVE_CREDIT_LINE=$CREDITCOIN_AAVE_CREDIT_LINE
CREDITCOIN_AAVE_PASSPORT_NFT=$CREDITCOIN_AAVE_PASSPORT_NFT
CREDITCOIN_AAVE_PASSPORT_ASC=$CREDITCOIN_AAVE_PASSPORT_ASC

Run bash scripts/aave-sepolia-e2e.sh, then:
npm run prove -- <AAVE_REPAY_TX> --aave --submit --claim <same wallet>
EOF
