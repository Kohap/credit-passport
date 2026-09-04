# Desk page override

**Route:** `/` (`apps/web` Desk)

## Purpose

90-second Attestcoin demo loop for judges: connect → faucet/open/repay on Sepolia → prove on Creditcoin → borrow / passport fields.

## Structure

1. **Hero** — Credit Passport brand + one sentence + Connect / Add networks
2. **Progress rail** — 3 steps; highlight based on repayTx / phase / verified
3. **Step 1 · Sepolia** — amount, loanId, faucet / open / repay + explorer link
4. **Step 2 · Prove** — prove CTA, phase status, CORS paste fallback when needed
5. **Step 3 · Unlock** — borrow + verified field readout (score before→after, cap, tokenId)
6. **Footnote** — Attestcoin precompile / score formula (collapsed secondary, not hero)

## Preserve behavior

All wagmi actions, prove phases, CORS paste panel, explorer links, and address gating must keep working. Visual redesign only.
