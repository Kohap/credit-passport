#!/usr/bin/env bash
# One-shot testnet deploy: Sepolia mocks → Creditcoin Passport stack.
# Run from a machine that can reach public RPCs (this Cloud Agent VM cannot —
# chain RPC hosts are outside the egress allowlist).
#
# Usage:
#   cp .env.example .env   # fill SEPOLIA_PRIVATE_KEY + CREDITCOIN_PRIVATE_KEY
#   ./scripts/deploy-all.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set private keys." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL in .env}"
: "${CREDITCOIN_RPC_URL:?Set CREDITCOIN_RPC_URL in .env}"

if [[ -z "${SEPOLIA_PRIVATE_KEY:-}" || -z "${CREDITCOIN_PRIVATE_KEY:-}" \
  || "$SEPOLIA_PRIVATE_KEY" == "0xREPLACE_ME" || "$CREDITCOIN_PRIVATE_KEY" == "0xREPLACE_ME" ]]; then
  cat >&2 <<'ERR'
ERROR: private keys are empty/placeholder in .env

Open .env in an editor and set both lines (same funded demo key is fine):

  SEPOLIA_PRIVATE_KEY=0xYOUR_KEY
  CREDITCOIN_PRIVATE_KEY=0xYOUR_KEY

Then re-run:  ./scripts/deploy-all.sh
ERR
  exit 1
fi

ADDR="$(cast wallet address --private-key "$SEPOLIA_PRIVATE_KEY")"
echo "==> Deployer: $ADDR"

echo "==> Balances"
SEP_BAL="$(cast balance "$ADDR" --rpc-url "$SEPOLIA_RPC_URL")"
CC_BAL="$(cast balance "$ADDR" --rpc-url "$CREDITCOIN_RPC_URL")"
echo "    Sepolia ETH:     $SEP_BAL wei"
echo "    Creditcoin tCTC: $CC_BAL wei"
if [[ "$SEP_BAL" == "0" || "$CC_BAL" == "0" ]]; then
  echo "ERROR: need non-zero balances on both chains before deploy." >&2
  exit 1
fi

need_forge_libs() {
  local dir="$1"
  [[ -f "$dir/lib/forge-std/src/Script.sol" ]] || return 0
  return 1
}

# Newer Foundry defaults to no git commit; older used --no-commit. Avoid both flags.
forge_install() {
  local dir="$1"
  shift
  (cd "$dir" && forge install "$@" </dev/null)
}

if need_forge_libs packages/contracts-sepolia; then
  echo "==> forge install (sepolia)"
  forge_install packages/contracts-sepolia foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
fi
if need_forge_libs packages/contracts-creditcoin; then
  echo "==> forge install (creditcoin)"
  forge_install packages/contracts-creditcoin foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
  (cd packages/contracts-creditcoin && npm install @gluwa/asc-contracts --no-fund --no-audit 2>/dev/null || true)
fi

echo "==> Deploy Sepolia MockUSD + MockMarket"
SEP_OUT="$(
  cd packages/contracts-sepolia
  forge script script/Deploy.s.sol:DeploySepolia \
    --rpc-url "$SEPOLIA_RPC_URL" \
    --broadcast \
    --private-key "$SEPOLIA_PRIVATE_KEY" \
    -vv
)"
echo "$SEP_OUT"
SEPOLIA_MOCK_USD="$(echo "$SEP_OUT" | sed -n 's/.*SEPOLIA_MOCK_USD[[:space:]]*//p' | tail -1 | tr -d '\r')"
SEPOLIA_MOCK_MARKET="$(echo "$SEP_OUT" | sed -n 's/.*SEPOLIA_MOCK_MARKET[[:space:]]*//p' | tail -1 | tr -d '\r')"
if [[ -z "$SEPOLIA_MOCK_USD" || -z "$SEPOLIA_MOCK_MARKET" ]]; then
  echo "ERROR: could not parse Sepolia addresses from forge output." >&2
  exit 1
fi

echo "==> Deploy Creditcoin Passport stack (trusted market=$SEPOLIA_MOCK_MARKET)"
export SEPOLIA_MOCK_MARKET
CC_OUT="$(
  cd packages/contracts-creditcoin
  forge script script/Deploy.s.sol:DeployCreditcoin \
    --rpc-url "$CREDITCOIN_RPC_URL" \
    --broadcast \
    --private-key "$CREDITCOIN_PRIVATE_KEY" \
    -vv
)"
echo "$CC_OUT"
CREDITCOIN_MOCK_USD="$(echo "$CC_OUT" | sed -n 's/.*CREDITCOIN_MOCK_USD[[:space:]]*//p' | tail -1 | tr -d '\r')"
CREDITCOIN_CREDIT_SCORE="$(echo "$CC_OUT" | sed -n 's/.*CREDITCOIN_CREDIT_SCORE[[:space:]]*//p' | tail -1 | tr -d '\r')"
CREDITCOIN_CREDIT_LINE="$(echo "$CC_OUT" | sed -n 's/.*CREDITCOIN_CREDIT_LINE[[:space:]]*//p' | tail -1 | tr -d '\r')"
CREDITCOIN_PASSPORT_NFT="$(echo "$CC_OUT" | sed -n 's/.*CREDITCOIN_PASSPORT_NFT[[:space:]]*//p' | tail -1 | tr -d '\r')"
CREDITCOIN_PASSPORT_ASC="$(echo "$CC_OUT" | sed -n 's/.*CREDITCOIN_PASSPORT_ASC[[:space:]]*//p' | tail -1 | tr -d '\r')"

mkdir -p packages/contracts-sepolia/deployments packages/contracts-creditcoin/deployments
cat > packages/contracts-sepolia/deployments/sepolia.json <<EOF
{
  "chainId": 11155111,
  "MockUSD": "$SEPOLIA_MOCK_USD",
  "MockMarket": "$SEPOLIA_MOCK_MARKET",
  "deployer": "$ADDR"
}
EOF
cat > packages/contracts-creditcoin/deployments/cc3-testnet.json <<EOF
{
  "chainId": 102031,
  "MockUSD": "$CREDITCOIN_MOCK_USD",
  "CreditScore": "$CREDITCOIN_CREDIT_SCORE",
  "CreditLine": "$CREDITCOIN_CREDIT_LINE",
  "PassportNFT": "$CREDITCOIN_PASSPORT_NFT",
  "CreditPassportASC": "$CREDITCOIN_PASSPORT_ASC",
  "trustedSepoliaMockMarket": "$SEPOLIA_MOCK_MARKET",
  "deployer": "$ADDR"
}
EOF

# Patch .env in place (keys already present as empty or placeholders)
patch_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
patch_env SEPOLIA_MOCK_USD "$SEPOLIA_MOCK_USD"
patch_env SEPOLIA_MOCK_MARKET "$SEPOLIA_MOCK_MARKET"
patch_env CREDITCOIN_MOCK_USD "$CREDITCOIN_MOCK_USD"
patch_env CREDITCOIN_CREDIT_SCORE "$CREDITCOIN_CREDIT_SCORE"
patch_env CREDITCOIN_CREDIT_LINE "$CREDITCOIN_CREDIT_LINE"
patch_env CREDITCOIN_PASSPORT_NFT "$CREDITCOIN_PASSPORT_NFT"
patch_env CREDITCOIN_PASSPORT_ASC "$CREDITCOIN_PASSPORT_ASC"
patch_env NEXT_PUBLIC_SEPOLIA_MOCK_USD "$SEPOLIA_MOCK_USD"
patch_env NEXT_PUBLIC_SEPOLIA_MOCK_MARKET "$SEPOLIA_MOCK_MARKET"
patch_env NEXT_PUBLIC_CREDITCOIN_MOCK_USD "$CREDITCOIN_MOCK_USD"
patch_env NEXT_PUBLIC_CREDITCOIN_CREDIT_SCORE "$CREDITCOIN_CREDIT_SCORE"
patch_env NEXT_PUBLIC_CREDITCOIN_CREDIT_LINE "$CREDITCOIN_CREDIT_LINE"
patch_env NEXT_PUBLIC_CREDITCOIN_PASSPORT_NFT "$CREDITCOIN_PASSPORT_NFT"
patch_env NEXT_PUBLIC_CREDITCOIN_PASSPORT_ASC "$CREDITCOIN_PASSPORT_ASC"

cat <<EOF

==> Deploy complete. Paste this block back into the agent chat (or commit the deployments/*.json files):

SEPOLIA_MOCK_USD=$SEPOLIA_MOCK_USD
SEPOLIA_MOCK_MARKET=$SEPOLIA_MOCK_MARKET
CREDITCOIN_MOCK_USD=$CREDITCOIN_MOCK_USD
CREDITCOIN_CREDIT_SCORE=$CREDITCOIN_CREDIT_SCORE
CREDITCOIN_CREDIT_LINE=$CREDITCOIN_CREDIT_LINE
CREDITCOIN_PASSPORT_NFT=$CREDITCOIN_PASSPORT_NFT
CREDITCOIN_PASSPORT_ASC=$CREDITCOIN_PASSPORT_ASC
EOF
