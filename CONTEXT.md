# Credit Passport — domain vocabulary

Terms for seams and modules. Keep these stable so architecture reviews and specs don’t invent synonyms.

## Domain

- **LoanRepaid signal** — Sepolia `MockMarket` event that Attestcoin must prove. Fixture source today; not a live lending pool.
- **Attestcoin proof** — Merkle + continuity artifact for a Sepolia tx once its height is attested (`chainKey` 1).
- **Proof document** — The single JSON shape Desk and the worker CLI exchange (paste / `--json-out`). Should be `proveRepayment`-ready.
- **Prove repayment** — Creditcoin `CreditPassportASC.proveRepayment` calling precompile `0x…0FD2` `verifyAndEmit`, then score / cap / passport.
- **Prove session** — The end-to-end client loop: wait source → wait attestation → generate proof → submit → verified | error.
- **Demo deployment** — Baked CC3 + Sepolia addresses, RPCs, prover URLs, explorers used by Desk, worker, and scripts.
- **Claim borrower** — Address asserted in `proveRepayment`; must match `LoanRepaid` borrower (one EOA on both chains).
- **Credit line draw** — Optional `CreditLine.borrow` after verify; requires funded mUSD liquidity.

## Architecture glossary (codebase-design)

Use: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**.  
Do not substitute: component, service, API (for interface), boundary (for seam).

## Settled constraints (Round 1 · 2026-09-04)

- Prize = live Attestcoin prove loop with explorer txs; CEIP story is one slide.
- CLI `npm run prove -- <tx> --submit` is proof source of truth; Pages is convenience.
- One MetaMask EOA on Sepolia + CC3.
- Name MockMarket as fixture in the first 15s.
- Freeze: no extra chains, AI, mainnet, writability, new scoring, token, Telegram, visual redesign.
- Do not change `LoanRepaid` layout or score formula before submission.
- Prefer editing existing files over new packages unless a seam already has two adapters.

## Architecture review

See `/tmp/architecture-review-20260904.html` (copy under `/opt/cursor/artifacts/`).
