# Credit Passport — 7 slides (speaker notes)

Paste into Gamma / Google slides. Speak from the notes under each slide.

---

## Slide 1 — Title (first 15s: name the mock)

**Credit Passport**  
MockMarket on Sepolia → Attestcoin verify → score / cap / Passport on Creditcoin.

**Notes:** BUIDL CTC 2026 · DeFi / Attestcoin. Say immediately: “MockMarket is the source fixture. The Attestcoin path is real. Next source is a live Sepolia lending-pool repay event.” One MetaMask EOA on both chains. Do not submit a Pages 404 as the demo video.

---

## Slide 2 — Problem

Cross-chain credit today trusts bridges, oracles, or backends.  
A repayment on Ethereum is invisible to Creditcoin unless someone can lie.

**Notes:** Judges score Attestcoin depth. We refuse “indexer says repaid.” Destination chain must verify the foreign tx itself.

---

## Slide 3 — Insight (must-say: 0xFD2 + receiptStatus)

Attestcoin lets Creditcoin contracts **read** foreign-chain txs with Merkle + continuity proofs.  
Verification and business logic run in **one** Creditcoin transaction.

**Notes:** Precompile **`0x0000000000000000000000000000000000000FD2`** (`verifyAndEmit`). ASC requires **`receiptStatus == 1`** (precompile does not check success). Also: emitter == Sepolia MockMarket, borrower match, replay via query id. If a judge cannot open a live `proveRepayment` tx, you did not integrate Attestcoin.

---

## Slide 4 — 90s loop (prize first)

1. Same wallet: faucet → open → repay on Sepolia MockMarket  
2. Wait until height attested  
3. `npm run prove -- <tx> --submit` (CLI = source of truth; Pages optional)  
4. Score ↑, borrow cap ↑, soulbound PASS minted  
5. If CreditLine funded: borrow 10 mUSD — else skip and say “cap + passport”

**Notes:** chainKey `1` = Sepolia on CC3 (≠ chainId `11155111`). Record the first successful prove the hour it happens.

---

## Slide 5 — Why this track

Depth of Attestcoin use is the score.  
We do **not** mock `verifyAndEmit`. We do **not** use Chainlink/Pyth as truth.

**Notes:** Live ASC: `0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb`. Show both explorer URLs from the HACKATHON PROOF block. Win the loop this week; CEIP is the post-place story.

---

## Slide 6 — Architecture + one CREATE footnote

Sepolia MockMarket (signal) → ProofBuilder CLI/UI → Creditcoin ASC (value).

**Notes:** Footnote once: “Same CREATE hex on two chains = nonce coincidence. Different networks.” Then ignore. Static Pages cannot host a Node prover — CORS → CLI Plan B. Freeze: no extra chains, AI, mainnet, writability, new scoring, token, Telegram, redesign.

---

## Slide 7 — Ask (after proof links exist)

Ask: Attestcoin depth now; next = replace MockMarket with Aave/Compound-style repay events (do not build that this week).

**Notes:** Demo URL only if Connect Wallet loads. Prototype video = successful CLI (or Desk) loop + explorer tabs. Limitations: readability only, attestation lag, mocks.
