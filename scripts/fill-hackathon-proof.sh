#!/usr/bin/env bash
# After demo-e2e (or manual prove), fill README HACKATHON PROOF table.
#
# Usage:
#   bash scripts/fill-hackathon-proof.sh <sepoliaTx> <creditcoinTx> [tokenId]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SEPOLIA_TX="${1:?sepolia tx hash}"
CREDIT_TX="${2:?creditcoin proveRepayment tx hash}"
TOKEN_ID="${3:-TBD}"

SEPOLIA_URL="https://sepolia.etherscan.io/tx/${SEPOLIA_TX}"
CREDIT_URL="https://creditcoin-testnet.blockscout.com/tx/${CREDIT_TX}"

python3 - <<PY
from pathlib import Path
p = Path("README.md")
text = p.read_text()
replacements = [
    ("| Sepolia \`LoanRepaid\` tx | **TBD** |", f"| Sepolia \`LoanRepaid\` tx | [\`{SEPOLIA_TX}\`]({SEPOLIA_URL}) |"),
    ("| Creditcoin \`proveRepayment\` tx | **TBD** |", f"| Creditcoin \`proveRepayment\` tx | [\`{CREDIT_TX}\`]({CREDIT_URL}) |"),
    ("| Passport tokenId | **TBD** |", f"| Passport tokenId | **{TOKEN_ID}** |"),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f"placeholder not found: {old}")
    text = text.replace(old, new, 1)
p.write_text(text)
print("Updated README.md hackathon proof table")
print("  Sepolia:", SEPOLIA_URL)
print("  Creditcoin:", CREDIT_URL)
print("  tokenId:", TOKEN_ID)
PY
