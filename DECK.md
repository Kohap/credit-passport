# Credit Passport — 1-page deck outline

Paste into Gamma / Google Slides.

## Slide 1 — Title
**Credit Passport**  
Prove Sepolia repayments on Creditcoin with Attestcoin. Unlock credit. Mint a soulbound Passport.  
BUIDL CTC 2026 · DeFi

## Slide 2 — Problem
Cross-chain credit today trusts bridges, oracles, or backends.  
A repayment on Ethereum is invisible to Creditcoin unless someone can lie.

## Slide 3 — Insight
Attestcoin makes Creditcoin contracts **read** foreign-chain txs with Merkle + continuity proofs.  
Verification and business logic run in **one** Creditcoin transaction.

## Slide 4 — Product
1. Borrow / repay on Sepolia MockMarket (`LoanRepaid` event)  
2. Attestcoin attests the block (~15s lag)  
3. `CreditPassportASC` verifies @ `0xFD2`, checks `receipt.status==1` + our event  
4. Score ↑, borrow cap ↑, soulbound PASS minted

## Slide 5 — Why this track
Depth of Attestcoin use is the score.  
We do not mock `verify()`. We do not use Chainlink/Pyth as truth.  
chainKey `1` = Sepolia on CC3 (≠ chainId `11155111`).

## Slide 6 — Architecture
Sepolia contracts (signal) → ProofBuilder worker/UI → Creditcoin ASC (value).  
See `docs/ARCHITECTURE.md`.

## Slide 7 — Demo (90s)
Connect → faucet → open → repay → prove → show score/cap/NFT + explorers.

## Slide 8 — Ask
Testnet deploy live on Sepolia + CC3.  
Next: more source events, batch proofs (≤10), real credit partners.
