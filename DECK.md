# Credit Passport - 7 slides (speaker notes)

Paste into Gamma or Google Slides. Every transaction below is live on public testnets.

---

## Slide 1 - Credit Passport

**Attestcoin-verified credit and execution history.**

Sepolia event -> Attestcoin proof -> Creditcoin credential.

**Notes:** Credit Passport is live at https://www.creditpassport.xyz/app. The loan source is a Sepolia MockMarket fixture; the Attestcoin verification, Creditcoin writes, and credentials are real. Start with the verified result, then show the loop.

---

## Slide 2 - The problem

A repayment or completed agent job on Ethereum is invisible to Creditcoin unless a bridge, oracle, or backend asserts that it happened.

**Notes:** We do not accept “an indexer says it happened.” A destination-chain contract should verify the foreign transaction receipt and expected event itself.

---

## Slide 3 - The primitive

Attestcoin supplies Merkle inclusion and continuity proofs. `verifyAndEmit` at `0x0000000000000000000000000000000000000FD2` verifies them on Creditcoin.

**Notes:** Both ASCs require `receiptStatus == 1`, enforce the trusted Sepolia event emitter, bind the caller to the event subject, and deduplicate proofs. The precompile verifies inclusion; the ASC applies product-specific policy.

---

## Slide 4 - Credit Passport, proven

Sepolia `LoanRepaid` -> Creditcoin `proveRepayment` -> score, borrow cap, soulbound PASS.

**Notes:** Live v2 proof: Sepolia [`0xac0843...228966`](https://sepolia.etherscan.io/tx/0xac0843bedc162ac75dee414dcf25a680a8a2dd8b66f7f7d4ffd07c4421228966), Creditcoin [`0x1f0752...78072d`](https://creditcoin-testnet.blockscout.com/tx/0x1f075244b34a295d176774ac5a7851fcde0306438584b249c04877bf3578072d), PASS `#1`. The live hardened ASC is `0x5123CdFd395414FcB6c5b8bc10A0843882EfD277`.

---

## Slide 5 - Agent Passport, proven

Client-funded job escrow -> agent commits result hash -> client releases payment -> Attestcoin proof -> soulbound Agent Passport.

**Notes:** A distinct ephemeral client wallet funded and approved the job; the agent wallet could not self-fund it. Live proof: Sepolia [`0x81744a...e64131`](https://sepolia.etherscan.io/tx/0x81744af17cdf623d839e2b6514d77f5fa00bb2e2101569f82128033cc3e64131), Creditcoin [`0x9a0472...dbc8bc`](https://creditcoin-testnet.blockscout.com/tx/0x9a0472dce66776f08df3c80a57d52fae22f000328d861412b841628f68dbc8bc). Agent Passport `#1` records one completed job and `1 mUSD` settled volume.

---

## Slide 6 - What the contracts actually guarantee

The source event must come from the trusted contract. The proof must be unique. The caller must be the credited wallet.

**Notes:** Agent escrow prevents one-wallet self-funding, releases only after client approval, and stores only a result commitment hash. It does not solve multi-wallet Sybil behavior or disputes; those are explicit next-stage policy problems, not claims we make today.

---

## Slide 7 - Live demo and next step

**Open the desk:** https://www.creditpassport.xyz/app
**Read the proof records:** https://github.com/Kohap/credit-passport

**Notes:** Demo the human-credit loop first. Then show the Agent Passport explorer links as the extension: the same Attestcoin mechanism validates economically settled execution, not merely claims. Next source integrations are real lending-pool repayments and agent identity or dispute policy, not a new verifier design.
