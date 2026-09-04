#!/usr/bin/env bash
# Resume Creditcoin deploy after Sepolia already succeeded.
# Usage (from repo root, with .env loaded):
#   bash scripts/deploy-creditcoin.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${CREDITCOIN_RPC_URL:?}"
: "${CREDITCOIN_PRIVATE_KEY:?}"
: "${SEPOLIA_MOCK_MARKET:?Set SEPOLIA_MOCK_MARKET in .env (from Sepolia deploy)}"

need_forge_libs() {
  local dir="$1"
  [[ -f "$dir/lib/forge-std/src/Script.sol" ]] || return 0
  return 1
}
forge_install() {
  local dir="$1"
  shift
  (cd "$dir" && forge install "$@" </dev/null)
}

if need_forge_libs packages/contracts-creditcoin; then
  forge_install packages/contracts-creditcoin \
    foundry-rs/forge-std@v1.9.4 \
    OpenZeppelin/openzeppelin-contracts@v5.0.2
  (cd packages/contracts-creditcoin && npm install @gluwa/asc-contracts --no-fund --no-audit 2>/dev/null || true)
fi

# Re-pin OZ if Cancun-only version was installed
ver="$(python3 -c "import json;print(json.load(open('packages/contracts-creditcoin/lib/openzeppelin-contracts/package.json')).get('version',''))" 2>/dev/null || echo "")"
if [[ -n "$ver" && "$ver" != "5.0.2" ]]; then
  echo "==> Re-pinning OpenZeppelin (found $ver, need 5.0.2)"
  rm -rf packages/contracts-creditcoin/lib/openzeppelin-contracts
  forge_install packages/contracts-creditcoin OpenZeppelin/openzeppelin-contracts@v5.0.2
fi

ADDR="$(cast wallet address --private-key "$CREDITCOIN_PRIVATE_KEY")"
echo "==> Deployer: $ADDR"
echo "==> trusted Sepolia MockMarket: $SEPOLIA_MOCK_MARKET"

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

mkdir -p packages/contracts-creditcoin/deployments
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

patch_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${val}|" .env
    else
      sed -i '' "s|^${key}=.*|${key}=${val}|" .env
    fi
  else
    echo "${key}=${val}" >> .env
  fi
}
patch_env CREDITCOIN_MOCK_USD "$CREDITCOIN_MOCK_USD"
patch_env CREDITCOIN_CREDIT_SCORE "$CREDITCOIN_CREDIT_SCORE"
patch_env CREDITCOIN_CREDIT_LINE "$CREDITCOIN_CREDIT_LINE"
patch_env CREDITCOIN_PASSPORT_NFT "$CREDITCOIN_PASSPORT_NFT"
patch_env CREDITCOIN_PASSPORT_ASC "$CREDITCOIN_PASSPORT_ASC"
patch_env NEXT_PUBLIC_CREDITCOIN_MOCK_USD "$CREDITCOIN_MOCK_USD"
patch_env NEXT_PUBLIC_CREDITCOIN_CREDIT_SCORE "$CREDITCOIN_CREDIT_SCORE"
patch_env NEXT_PUBLIC_CREDITCOIN_CREDIT_LINE "$CREDITCOIN_CREDIT_LINE"
patch_env NEXT_PUBLIC_CREDITCOIN_PASSPORT_NFT "$CREDITCOIN_PASSPORT_NFT"
patch_env NEXT_PUBLIC_CREDITCOIN_PASSPORT_ASC "$CREDITCOIN_PASSPORT_ASC"
# Keep Sepolia addresses if present from earlier run
patch_env SEPOLIA_MOCK_MARKET "$SEPOLIA_MOCK_MARKET"
if [[ -n "${SEPOLIA_MOCK_USD:-}" ]]; then
  patch_env SEPOLIA_MOCK_USD "$SEPOLIA_MOCK_USD"
  patch_env NEXT_PUBLIC_SEPOLIA_MOCK_USD "$SEPOLIA_MOCK_USD"
  patch_env NEXT_PUBLIC_SEPOLIA_MOCK_MARKET "$SEPOLIA_MOCK_MARKET"
fi

cat <<EOF

==> Creditcoin deploy complete. Paste this block back:

SEPOLIA_MOCK_USD=${SEPOLIA_MOCK_USD:-}
SEPOLIA_MOCK_MARKET=$SEPOLIA_MOCK_MARKET
CREDITCOIN_MOCK_USD=$CREDITCOIN_MOCK_USD
CREDITCOIN_CREDIT_SCORE=$CREDITCOIN_CREDIT_SCORE
CREDITCOIN_CREDIT_LINE=$CREDITCOIN_CREDIT_LINE
CREDITCOIN_PASSPORT_NFT=$CREDITCOIN_PASSPORT_NFT
CREDITCOIN_PASSPORT_ASC=$CREDITCOIN_PASSPORT_ASC
EOF
