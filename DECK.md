# Credit Passport — 7 slides (speaker notes)

Paste into Gamma / Google slides. Speak from the notes under each slide.

---

## Slide 1 — Title

**Credit Passport**  
Prove Sepolia repayments on Creditcoin with Attestcoin. Unlock credit. Mint a soulbound Passport.

**Notes:** BUIDL CTC 2026 Fall, DeFi track. Live desk: https://kohap.github.io/credit-passport/. One product: Attestcoin readability → underwriting outcome.

---

## Slide 2 — Problem

Cross-chain credit today trusts bridges, oracles, or backends.  
A repayment on Ethereum is invisible to Creditcoin unless someone can lie.

**Notes:** Judges care about depth of Attestcoin use. We refuse “indexer says repaid.” Destination chain must verify the foreign tx itself.

---

## Slide 3 — Insight

Attestcoin lets Creditcoin contracts **read** foreign-chain txs with Merkle + continuity proofs.  
Verification and business logic run in **one** Creditcoin transaction.

**Notes:** Precompile **`0x0000000000000000000000000000000000000FD2`** (`verifyAndEmit`). ASC then requires **`receiptStatus == 1`** because the precompile does not check success — failed txs must not raise credit. Also: emitter == Sepolia MockMarket, borrower match, replay via query id.

---

## Slide 4 — Product flow

1. Borrow / repay on Sepolia MockMarket → `LoanRepaid`  
2. Wait until height attested (~15s lag)  
3. ProofBuilder → `getProof`  
4. `CreditPassportASC.proveRepayment` → score ↑, cap ↑, soulbound PASS minted  
5. Optional: borrow 10 mUSD on CreditLine

**Notes:** Demo phases in the UI: waiting_source → waiting_attestation → generating_proof → submitting → verified. chainKey `1` = Sepolia on CC3 (≠ chainId `11155111`).

---

## Slide 5 — Why this track / why Attestcoin

Depth of Attestcoin use is the score.  
We do **not** mock `verifyAndEmit` in the demo path. We do **not** use Chainlink/Pyth as truth.

**Notes:** Live ASC: `0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb`. Worker prints a HACKATHON PROOF block with both explorer URLs after `--submit`.

---

## Slide 6 — Architecture

Sepolia contracts (signal) → ProofBuilder (browser or CLI) → Creditcoin ASC (value).  
See `docs/ARCHITECTURE.md`.

**Notes:** Static Pages cannot host a Node prover — proof is in-browser with CORS fallback to `npm run prove`. CreditLine needs mUSD liquidity (`scripts/fund-creditline.sh`).

---

## Slide 7 — 90s demo + ask

Connect → Add networks → Faucet → Open → Repay → Prove → show score/cap/NFT + explorers → Borrow.

**Notes:** Ask: live Sepolia + CC3 deploy; next season = more source events, batch proofs (≤10), real credit partners. Limitations: readability only, attestation lag, mocks.
