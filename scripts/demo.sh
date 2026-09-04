#!/usr/bin/env bash
# Exact click path for the <90s demo video.
set -euo pipefail

cat <<'EOF'
Credit Passport — camera path (≤90s)

0. Prefund wallet with Sepolia ETH + tCTC (Discord faucet). Deploy contracts; paste addresses into .env.
1. Open http://localhost:3000 (npm run dev:web).
2. Connect wallet. Click "Add Sepolia + CC3 to wallet".
3. Badge check: Sepolia 11155111 · Creditcoin 102031 · chainKey 1.
4. Faucet mUSD → Open loan (100) → Repay loan (100).
5. Copy Sepolia tx link from the UI (LoanRepaid).
6. Click "Prove repayment on Creditcoin".
   Narrate: waiting attestation → generating Merkle+continuity proof → wallet signs proveRepayment.
7. Show Verified fields: attested block, score, cap, NFT id.
8. Open Creditcoin explorer tx + attestor dashboard.
9. Say: "Attestcoin verified inclusion. Contract checked receipt.status==1 and our LoanRepaid log. No oracle operator."

CLI alternative after step 5:
  npm run prove -- 0xSEPOLIA_TX --submit --claim 0xYOU
EOF
