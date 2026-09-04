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
# Pin OZ to v5.0.2 — v5.7+ needs Cancun (mcopy); Creditcoin profile is shanghai.
forge_install() {
  local dir="$1"
  shift
  (cd "$dir" && forge install "$@" </dev/null)
}

if need_forge_libs packages/contracts-sepolia; then
  echo "==> forge install (sepolia)"
  forge_install packages/contracts-sepolia \
    foundry-rs/forge-std@v1.9.4 \
    OpenZeppelin/openzeppelin-contracts@v5.0.2
fi
if need_forge_libs packages/contracts-creditcoin; then
  echo "==> forge install (creditcoin)"
  forge_install packages/contracts-creditcoin \
    foundry-rs/forge-std@v1.9.4 \
    OpenZeppelin/openzeppelin-contracts@v5.0.2
  (cd packages/contracts-creditcoin && npm install @gluwa/asc-contracts --no-fund --no-audit 2>/dev/null || true)
fi

# If OZ was previously installed at a Cancun-only tag, force the shanghai-safe pin.
ensure_oz_pin() {
  local dir="$1"
  local tag_file="$dir/lib/openzeppelin-contracts/.git/HEAD"
  if [[ -d "$dir/lib/openzeppelin-contracts" ]] && ! grep -q 'v5.0.2\|5.0.2' "$dir/lib/openzeppelin-contracts/package.json" 2>/dev/null; then
    local ver
    ver="$(python3 -c "import json;print(json.load(open('$dir/lib/openzeppelin-contracts/package.json')).get('version',''))" 2>/dev/null || true)"
    if [[ -n "$ver" && "$ver" != "5.0.2" ]]; then
      echo "==> Re-pinning OpenZeppelin in $dir (found $ver, need 5.0.2 for shanghai)"
      rm -rf "$dir/lib/openzeppelin-contracts"
      forge_install "$dir" OpenZeppelin/openzeppelin-contracts@v5.0.2
    fi
  fi
}
ensure_oz_pin packages/contracts-sepolia
ensure_oz_pin packages/contracts-creditcoin

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
mkdir -p packages/contracts-sepolia/deployments
cat > packages/contracts-sepolia/deployments/sepolia.json <<EOF
{
  "chainId": 11155111,
  "MockUSD": "$SEPOLIA_MOCK_USD",
  "MockMarket": "$SEPOLIA_MOCK_MARKET",
  "deployer": "$ADDR"
}
EOF
# Persist Sepolia addresses so the Creditcoin helper can source them.
if grep -q '^SEPOLIA_MOCK_USD=' .env; then
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^SEPOLIA_MOCK_USD=.*|SEPOLIA_MOCK_USD=${SEPOLIA_MOCK_USD}|" .env
    sed -i "s|^SEPOLIA_MOCK_MARKET=.*|SEPOLIA_MOCK_MARKET=${SEPOLIA_MOCK_MARKET}|" .env
  else
    sed -i '' "s|^SEPOLIA_MOCK_USD=.*|SEPOLIA_MOCK_USD=${SEPOLIA_MOCK_USD}|" .env
    sed -i '' "s|^SEPOLIA_MOCK_MARKET=.*|SEPOLIA_MOCK_MARKET=${SEPOLIA_MOCK_MARKET}|" .env
  fi
else
  echo "SEPOLIA_MOCK_USD=${SEPOLIA_MOCK_USD}" >> .env
  echo "SEPOLIA_MOCK_MARKET=${SEPOLIA_MOCK_MARKET}" >> .env
fi
export SEPOLIA_MOCK_USD SEPOLIA_MOCK_MARKET
bash "$ROOT/scripts/deploy-creditcoin.sh"
exit 0
