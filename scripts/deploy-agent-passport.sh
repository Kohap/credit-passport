#!/usr/bin/env bash
# Deploy the Agent Passport alpha without touching the live Credit Passport v2 contracts.
# Uses the existing v2 Sepolia MockUSD as escrow asset.
# Usage: bash scripts/deploy-agent-passport.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example, set funded testnet keys, then retry." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL in .env}"
: "${SEPOLIA_PRIVATE_KEY:?Set SEPOLIA_PRIVATE_KEY in .env}"
: "${SEPOLIA_MOCK_USD:?Set SEPOLIA_MOCK_USD to the v2 Sepolia MockUSD address}"
: "${CREDITCOIN_RPC_URL:?Set CREDITCOIN_RPC_URL in .env}"
: "${CREDITCOIN_PRIVATE_KEY:?Set CREDITCOIN_PRIVATE_KEY in .env}"

for key in SEPOLIA_PRIVATE_KEY CREDITCOIN_PRIVATE_KEY; do
  value="${!key}"
  if [[ ! "$value" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "ERROR: $key must be a 0x-prefixed 32-byte private key." >&2
    exit 1
  fi
done

DEPLOYER="$(cast wallet address --private-key "$SEPOLIA_PRIVATE_KEY")"
echo "==> Agent Passport alpha deployer: $DEPLOYER"
echo "==> Sepolia escrow asset: $SEPOLIA_MOCK_USD"

SEP_CREATE=(forge create --broadcast --rpc-url "$SEPOLIA_RPC_URL" --private-key "$SEPOLIA_PRIVATE_KEY")
CC_CREATE=(forge create --broadcast --rpc-url "$CREDITCOIN_RPC_URL" --private-key "$CREDITCOIN_PRIVATE_KEY" --legacy)

echo "==> Deploy Sepolia AgentJobEscrow"
ESCROW_OUT="$(cd packages/contracts-sepolia && "${SEP_CREATE[@]}" src/AgentJobEscrow.sol:AgentJobEscrow --constructor-args "$SEPOLIA_MOCK_USD")"
echo "$ESCROW_OUT"
SEPOLIA_AGENT_JOB_ESCROW="$(echo "$ESCROW_OUT" | sed -n 's/.*Deployed to:[[:space:]]*//p' | tail -1 | tr -d '\r')"

echo "==> Deploy Creditcoin AgentPassportNFT"
NFT_OUT="$(cd packages/contracts-creditcoin && "${CC_CREATE[@]}" src/AgentPassportNFT.sol:AgentPassportNFT --constructor-args "$DEPLOYER")"
echo "$NFT_OUT"
CREDITCOIN_AGENT_PASSPORT_NFT="$(echo "$NFT_OUT" | sed -n 's/.*Deployed to:[[:space:]]*//p' | tail -1 | tr -d '\r')"

echo "==> Deploy Creditcoin AgentPassportASC"
ASC_OUT="$(cd packages/contracts-creditcoin && "${CC_CREATE[@]}" src/AgentPassportASC.sol:AgentPassportASC --constructor-args "$SEPOLIA_AGENT_JOB_ESCROW" "$CREDITCOIN_AGENT_PASSPORT_NFT")"
echo "$ASC_OUT"
CREDITCOIN_AGENT_PASSPORT_ASC="$(echo "$ASC_OUT" | sed -n 's/.*Deployed to:[[:space:]]*//p' | tail -1 | tr -d '\r')"

for key in SEPOLIA_AGENT_JOB_ESCROW CREDITCOIN_AGENT_PASSPORT_NFT CREDITCOIN_AGENT_PASSPORT_ASC; do
  value="${!key}"
  if [[ ! "$value" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo "ERROR: failed to parse $key from forge output." >&2
    exit 1
  fi
done

echo "==> Grant AgentPassportASC the credential minter role"
cast send "$CREDITCOIN_AGENT_PASSPORT_NFT" "setMinter(address)" "$CREDITCOIN_AGENT_PASSPORT_ASC" \
  --rpc-url "$CREDITCOIN_RPC_URL" --private-key "$CREDITCOIN_PRIVATE_KEY" --legacy

cat <<EOF

==> Agent Passport alpha deployed. Add these to .env only after verifying the explorer transactions:

SEPOLIA_AGENT_JOB_ESCROW=$SEPOLIA_AGENT_JOB_ESCROW
CREDITCOIN_AGENT_PASSPORT_NFT=$CREDITCOIN_AGENT_PASSPORT_NFT
CREDITCOIN_AGENT_PASSPORT_ASC=$CREDITCOIN_AGENT_PASSPORT_ASC

The live loan demo is unchanged. Follow docs/AGENT_PASSPORT.md for the first funded job and proof flow.
EOF
