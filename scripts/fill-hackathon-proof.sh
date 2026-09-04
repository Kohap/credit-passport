#!/usr/bin/env bash
# After demo-e2e (or manual prove), fill README HACKATHON PROOF table.
#
# Usage:
#   bash scripts/fill-hackathon-proof.sh 0xSEPOLIA_TX 0xCREDITCOIN_TX [tokenId]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SEPOLIA_TX="${1:?sepolia tx hash}"
CREDIT_TX="${2:?creditcoin proveRepayment tx hash}"
TOKEN_ID="${3:-TBD}"

python3 - "$SEPOLIA_TX" "$CREDIT_TX" "$TOKEN_ID" <<'PY'
import sys
from pathlib import Path
sepolia, credit, token_id = sys.argv[1], sys.argv[2], sys.argv[3]
sepolia_url = f"https://sepolia.etherscan.io/tx/{sepolia}"
credit_url = f"https://creditcoin-testnet.blockscout.com/tx/{credit}"
p = Path("README.md")
text = p.read_text()
reps = [
    ("| Sepolia `LoanRepaid` tx | **TBD** |",
     f"| Sepolia `LoanRepaid` tx | [`{sepolia}`]({sepolia_url}) |"),
    ("| Creditcoin `proveRepayment` tx | **TBD** |",
     f"| Creditcoin `proveRepayment` tx | [`{credit}`]({credit_url}) |"),
    ("| Passport tokenId | **TBD** |",
     f"| Passport tokenId | **{token_id}** |"),
]
for old, new in reps:
    if old not in text:
        raise SystemExit(f"placeholder not found (already filled?): {old}")
    text = text.replace(old, new, 1)
p.write_text(text)
print("Updated README.md hackathon proof table")
print("  Sepolia:", sepolia_url)
print("  Creditcoin:", credit_url)
print("  tokenId:", token_id)
PY
