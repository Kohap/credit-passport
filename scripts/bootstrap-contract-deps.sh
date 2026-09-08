#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_foundry_deps() {
  local directory="$1"
  if [[ -d "$directory/lib/forge-std" && -d "$directory/lib/openzeppelin-contracts" ]]; then
    return
  fi
  (
    cd "$directory"
    forge install --no-git --shallow \
      foundry-rs/forge-std@v1.9.4 \
      OpenZeppelin/openzeppelin-contracts@v5.0.2
  )
}

install_foundry_deps "$ROOT/packages/contracts-sepolia"
install_foundry_deps "$ROOT/packages/contracts-creditcoin"

if [[ ! -d "$ROOT/packages/contracts-creditcoin/node_modules/@gluwa/asc-contracts" ]]; then
  npm_config_cache="${TMPDIR:-/tmp}/credit-passport-npm-cache" \
    npm install --prefix "$ROOT/packages/contracts-creditcoin" --no-save @gluwa/asc-contracts@0.2.1
fi
