# Credit Passport

**BUIDL CTC 2026 Fall · DeFi track · Attestcoin Protocol**

Credit Passport proves a borrower repaid on **Ethereum Sepolia** (today: a **MockMarket** fixture), then raises a borrow cap and mints a soulbound **Credit Passport** NFT on **Creditcoin CC3 Testnet** — optionally drawing from a funded CreditLine. Underwriting only advances after **Attestcoin** cryptographically verifies the source-chain tx and its `LoanRepaid` event. The loan source is mock; the Attestcoin path is real.

> The hardened v2 testnet deployment is live as of 2026-09-08. It limits each wallet to one demo loan, credits only a fully closed loan once, and restricts market-inventory minting to the deployer.

## Why Attestcoin is required

Repayment lives on Sepolia; credit decisions live on Creditcoin. Attestcoin is the only on-chain source of truth that the Sepolia tx existed, succeeded (`receiptStatus == 1`), and emitted our event before score / cap / NFT update.

## Live demo

- **Desk:** [https://www.creditpassport.xyz/app](https://www.creditpassport.xyz/app)
- **Landing:** [https://www.creditpassport.xyz/](https://www.creditpassport.xyz/)
- **Source:** [github.com/Kohap/credit-passport](https://github.com/Kohap/credit-passport)
- **Local:** `npm run dev:web`

The browser desk prepares the proof through its same-origin proxy. If the external prover is unavailable, the CLI can generate a pasteable `proof.json` with `npm run prove -- <sepoliaTx> --json-out proof.json`.

## Architecture

```text
Sepolia MockMarket repayment
  -> LoanRepaid event
  -> Attestcoin proof builder (Merkle inclusion + continuity)
  -> CreditPassportASC on Creditcoin CC3
  -> receipt and event validation
  -> CreditScore + CreditLine + soulbound Passport NFT
```

The borrower uses the same wallet on Sepolia and Creditcoin. No oracle operator decides whether a repayment counts: the Creditcoin contract verifies the Attestcoin-backed transaction receipt and requires the expected `LoanRepaid` log from the trusted Sepolia market.

## Security and trust model

The live v2 path rejects a wrong chain key, invalid or replayed proof, failed receipt, untrusted event emitter, different borrower, partial repayment, and duplicate borrower/loan credit. See [`docs/SECURITY.md`](docs/SECURITY.md) for the complete control-to-test mapping and operational limits.

## V2 end-to-end proof

| Artifact | Value |
| --- | --- |
| Sepolia `LoanRepaid` tx | [`0xac0843bedc162ac75dee414dcf25a680a8a2dd8b66f7f7d4ffd07c4421228966`](https://sepolia.etherscan.io/tx/0xac0843bedc162ac75dee414dcf25a680a8a2dd8b66f7f7d4ffd07c4421228966) |
| Creditcoin `proveRepayment` tx | [`0x1f075244b34a295d176774ac5a7851fcde0306438584b249c04877bf3578072d`](https://creditcoin-testnet.blockscout.com/tx/0x1f075244b34a295d176774ac5a7851fcde0306438584b249c04877bf3578072d) |
| Passport tokenId | **1**, minted to `0x01e4A64145873c0574c6d77C0d7e07d313B3F2fa`. |

The previous v1 proof is deliberately not presented as evidence for the new trusted-market deployment.

## Agent Passport alpha

Agent Passport is a separate live testnet alpha: client-funded Sepolia job escrow, a committed offchain work result, and Attestcoin-verified completion on Creditcoin. It does not alter the live Credit Passport v2 contracts or its proven loan flow.

| Contract | Network | Address |
| --- | --- | --- |
| AgentJobEscrow | Sepolia | [`0x294400Ddd3F6E11F04d0e16416cc677Dc134a2E1`](https://sepolia.etherscan.io/address/0x294400Ddd3F6E11F04d0e16416cc677Dc134a2E1) |
| AgentPassportNFT | Creditcoin CC3 | [`0x7c052F21153352bf326Ed3fDecC678fEFB177284`](https://creditcoin-testnet.blockscout.com/address/0x7c052F21153352bf326Ed3fDecC678fEFB177284) |
| AgentPassportASC | Creditcoin CC3 | [`0x965bdfEcD8ac53885d1d899E99814Af2752E16C8`](https://creditcoin-testnet.blockscout.com/address/0x965bdfEcD8ac53885d1d899E99814Af2752E16C8) |

| First verified agent completion | Evidence |
| --- | --- |
| Sepolia `JobCompleted` tx | [`0x81744af17cdf623d839e2b6514d77f5fa00bb2e2101569f82128033cc3e64131`](https://sepolia.etherscan.io/tx/0x81744af17cdf623d839e2b6514d77f5fa00bb2e2101569f82128033cc3e64131) |
| Creditcoin `proveJobCompletion` tx | [`0x9a0472dce66776f08df3c80a57d52fae22f000328d861412b841628f68dbc8bc`](https://creditcoin-testnet.blockscout.com/tx/0x9a0472dce66776f08df3c80a57d52fae22f000328d861412b841628f68dbc8bc) |
| Agent Passport | **#1** for `0x01e4A64145873c0574c6d77C0d7e07d313B3F2fa`; 1 completed job, 1 mUSD settled |

Its trust model, verification procedure, and known Sybil/dispute limitations are documented in [`docs/AGENT_PASSPORT.md`](docs/AGENT_PASSPORT.md).

## Aave repayment alpha

The repository contains a separate Aave V3 Sepolia repayment adapter. It leaves the live MockMarket v2 and Agent Passport demos unchanged. The deployed alpha requires Attestcoin proof of a successful, direct `repay(asset, type(uint256).max, 2, borrower)` transaction and a matching Pool `Repay` event. A live LINK-backed full repayment and Creditcoin proof were verified on 2026-09-10. See [alpha status and remaining limitations](docs/AAVE_ALPHA.md).

The addresses below are the verified deployment of the current source. Historical experiments are not listed here.

| Contract | Network | Address |
| --- | --- | --- |
| Aave V3 Pool | Sepolia | [`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`](https://sepolia.etherscan.io/address/0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951) |
| Aave repayment ASC | Creditcoin CC3 | [`0xCC83b2d0b052DEc64Ddb80915eC408b933b7B29f`](https://creditcoin-testnet.blockscout.com/address/0xCC83b2d0b052DEc64Ddb80915eC408b933b7B29f) |
| Aave alpha CreditScore | Creditcoin CC3 | [`0x3E66613643DaB431BB1cED436DB94828A15189b8`](https://creditcoin-testnet.blockscout.com/address/0x3E66613643DaB431BB1cED436DB94828A15189b8) |
| Aave alpha CreditLine | Creditcoin CC3 | [`0xB659a98E1c6dBf4bf921eBF0a7f9e062d049F3f3`](https://creditcoin-testnet.blockscout.com/address/0xB659a98E1c6dBf4bf921eBF0a7f9e062d049F3f3) |
| Aave alpha PassportNFT | Creditcoin CC3 | [`0xcEb5184F907775EB1bced75e81F4cd9f29022f12`](https://creditcoin-testnet.blockscout.com/address/0xcEb5184F907775EB1bced75e81F4cd9f29022f12) |

Start with `bash scripts/aave-sepolia-e2e.sh --check --collateral LINK` (read-only). The write-enabled script can create a source repayment, then `npm run prove -- <AAVE_REPAY_TX> --aave --submit --claim <same wallet>` can submit it. This adapter covers one reserve's variable debt, not every position or production underwriting.

## Deployed addresses

Demo deployer: [`0x01e4A64145873c0574c6d77C0d7e07d313B3F2fa`](https://creditcoin-testnet.blockscout.com/address/0x01e4A64145873c0574c6d77C0d7e07d313B3F2fa)

| Contract | Network | Address |
| --- | --- | --- |
| MockUSD | Sepolia | [`0x3937cFf0385AF9aAA25212432f030Ddbb1B98798`](https://sepolia.etherscan.io/address/0x3937cFf0385AF9aAA25212432f030Ddbb1B98798) |
| MockMarket | Sepolia | [`0x697CAf8096Bc604048C0d0CA0Dd587A509108783`](https://sepolia.etherscan.io/address/0x697CAf8096Bc604048C0d0CA0Dd587A509108783) |
| MockUSD | Creditcoin | [`0x3937cFf0385AF9aAA25212432f030Ddbb1B98798`](https://creditcoin-testnet.blockscout.com/address/0x3937cFf0385AF9aAA25212432f030Ddbb1B98798) |
| CreditScore | Creditcoin | [`0x697CAf8096Bc604048C0d0CA0Dd587A509108783`](https://creditcoin-testnet.blockscout.com/address/0x697CAf8096Bc604048C0d0CA0Dd587A509108783) |
| CreditLine | Creditcoin | [`0xd23Ba880D8C459A6A489017A021301053b3bC6fb`](https://creditcoin-testnet.blockscout.com/address/0xd23Ba880D8C459A6A489017A021301053b3bC6fb) |
| PassportNFT | Creditcoin | [`0xEe9F1B0d59ACcaa33434dF32F9b1233a3C78E381`](https://creditcoin-testnet.blockscout.com/address/0xEe9F1B0d59ACcaa33434dF32F9b1233a3C78E381) |
| CreditPassportASC | Creditcoin | [`0x5123CdFd395414FcB6c5b8bc10A0843882EfD277`](https://creditcoin-testnet.blockscout.com/address/0x5123CdFd395414FcB6c5b8bc10A0843882EfD277) |

JSON: `packages/*/deployments/*.json`. Same hex across chains is a CREATE-address coincidence (matching deployer nonces) — different networks.

## 90-second demo path (one MetaMask EOA)

Say out loud: **same wallet on Sepolia + CC3** (ASC reverts `BorrowerMismatch` otherwise).

1. **Connect** one account → **Add Sepolia + CC3**.
2. Sepolia: **Faucet** → **Open** MockMarket loan → **Repay** (`LoanRepaid`).
3. Prove: prefer `npm run prove -- <tx> --submit --claim <sameAddress>` (or Desk prove if CORS allows).
4. Show explorers + score before/after + cap + passport tokenId.
5. **Only if funded:** `bash scripts/fund-creditline.sh` once, then **Borrow 10 mUSD**. If unfunded, stop at cap + NFT — do not claim “unlock a line” you cannot draw.

## CLI fallback (CORS / offline proof)

If the browser prover is blocked:

```bash
npm run prove -- 0xSEPOLIA_TX_HASH --json-out proof.json
npm run prove -- 0xSEPOLIA_TX_HASH --submit --claim 0xYourAddress
```

`--json-out` writes a **flat** proof document (`merkleRoot`, `siblings`, `txBytes`, …) that Desk paste accepts directly (ADR-0003). Paste `proof.json` into the CORS fallback panel.

## Reproduce one proof

```bash
cp .env.example .env   # set SEPOLIA_* + CREDITCOIN_* keys (same funded EOA, Sepolia ETH + tCTC)
npm install
bash scripts/fund-creditline.sh
bash scripts/demo-e2e.sh                 # mint→open→repay→prove --submit (tees HACKATHON PROOF)
# then:
bash scripts/fill-hackathon-proof.sh <sepoliaTx> <creditcoinTx> [tokenId]
# hit record the same hour
```

## Networks

| Network | EVM chainId | Attestcoin chainKey | RPC |
| --- | --- | --- | --- |
| Ethereum Sepolia | `11155111` | **`1`** (not the chainId) | `SEPOLIA_RPC_URL` |
| Creditcoin CC3 Testnet | `102031` | n/a (destination) | `https://rpc.cc3-testnet.creditcoin.network` |

- Explorer: https://creditcoin-testnet.blockscout.com/
- Attestor dashboard: https://dashboard.cc3-testnet.creditcoin.network/
- Proof builder: https://prover.cc3-testnet.creditcoin.network (fallback: `https://proof-gen-api.cc3-testnet.creditcoin.network`)
- Query verifier precompile: `0x0000000000000000000000000000000000000FD2`
- ChainInfo precompile: `0x…0fd3`

**Pitfall:** `chainKey` ≠ EVM `chainId`. Sepolia’s chainKey on CC3 testnet is `1`.

## Scoring (hardened v2)

- Only a verified **fully closed** demo loan can change score
- A borrower/loan pair can be credited once
- +50 first verified closed repayment
- +30 each additional verified closed repayment
- Total score capped at **100**
- `borrowCap = 100 mUSD + (score × 2 mUSD)`

## Attestcoin step-by-step (judge checklist)

1. User repays on Sepolia `MockMarket` → `LoanRepaid(...)`.
2. Worker/UI waits until that height is attested (`ProofBuilder.waitUntilHeightAttested`).
3. Hosted prover returns Merkle + continuity proofs (`getProof`).
4. `CreditPassportASC.proveRepayment` calls precompile **`0x…0FD2`** `verifyAndEmit`.
5. ASC decodes `txBytes` with official `EvmV1Decoder`, **requires `receiptStatus == 1`**, requires log emitter == trusted Sepolia MockMarket, requires borrower match, then updates score / cap / NFT.

No Chainlink, Pyth, or centralized backend decides the repayment.

## Repo layout

```
packages/contracts-sepolia/     MockUSD + MockMarket (LoanRepaid)
packages/contracts-creditcoin/  ASC + score + line + soulbound NFT
packages/worker/                prove.ts CLI (@gluwa/usc-sdk)
apps/web/                       Next.js dual-chain desk
scripts/fund-creditline.sh     mint/transfer mUSD → CreditLine
scripts/demo-e2e.sh             full faucet → prove path
docs/ARCHITECTURE.md
DECK.md
```

## Local setup

```bash
cp .env.example .env
# set SEPOLIA_RPC_URL (public or Alchemy/Infura — never commit paid keys)
# set SEPOLIA_PRIVATE_KEY / CREDITCOIN_PRIVATE_KEY only when deploying/submitting

npm install

# Install Foundry dependencies and run unit tests (no live precompile required)
npm run test:contracts
```

## Deploy (testnets)

```bash
cp .env.example .env
# set SEPOLIA_PRIVATE_KEY + CREDITCOIN_PRIVATE_KEY (funded deployer)

bash scripts/deploy-all.sh
# or, if Sepolia is already live:
# bash scripts/deploy-creditcoin.sh
```

Creditcoin uses `forge create` (not `forge script`) because CC3 Substrate EVM omits `prevrandao` and Foundry always simulates scripts locally.

### Faucets

- **Sepolia ETH:** public Sepolia faucets.
- **tCTC:** Creditcoin Discord faucet (https://discord.gg/creditcoin — CC3 testnet channel).
- **mUSD:** `MockUSD.faucet()` on Sepolia from the UI; CreditLine liquidity via `bash scripts/fund-creditline.sh`.

## Worker proof CLI

```bash
npm run prove -- 0xSEPOLIA_TX_HASH --json-out /tmp/proof.json
npm run prove -- 0xSEPOLIA_TX_HASH --submit --claim 0xYourAddress
```

`CREDITCOIN_PASSPORT_ASC` defaults to `0x5123CdFd395414FcB6c5b8bc10A0843882EfD277`.

## Web UI / Pages

```bash
npm run dev:web          # local at /
npm run build:pages      # static export with basePath /credit-passport
```

Proof building runs in the browser (Pages has no Node API). Addresses are baked into `apps/web/src/config/networks.ts` — no GitHub Actions secrets required to build.

## Limitations

- Attestcoin **readability only** this season (no writability).
- Attestation lag; proof gen can take minutes if the height is not yet attested.
- Mock loans / mock USD — not production underwriting.
- Live `0xFD2` verification only works on Creditcoin CC3 testnet (unit tests mock the precompile).

## If GitHub Actions Pages still fails

```bash
# locally
npm install                    # refreshes package-lock.json
npm run build:tokens           # if present
GITHUB_PAGES=true npm run build:pages
ls apps/web/out/.nojekyll apps/web/out/index.html

# on GitHub
# Settings → Pages → Source: GitHub Actions
# Actions → Deploy GitHub Pages → Re-run failed jobs
```

## Attribution

- Proof / ASC patterns follow official Gluwa examples and `@gluwa/asc-contracts` (`ASCBase`, `EvmV1Decoder`, `INativeQueryVerifier`).
- SDK: `@gluwa/usc-sdk`.
- References: https://github.com/gluwa/usc-testnet-bridge-examples · https://github.com/gluwa/attestcoin-protocol-examples

## License

Copyright © 2026 Kohap. All rights reserved.

Credit Passport is proprietary software. It is not MIT-licensed and is not free
to copy, modify, or redistribute. See [`LICENSE`](LICENSE).
