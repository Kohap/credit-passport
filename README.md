# Credit Passport

**BUIDL CTC 2026 Fall · DeFi track · Attestcoin Protocol**

Credit Passport proves a borrower repaid on **Ethereum Sepolia** (today: a **MockMarket** fixture), then raises a borrow cap and mints a soulbound **Credit Passport** NFT on **Creditcoin CC3 Testnet** — optionally drawing from a funded CreditLine. Underwriting only advances after **Attestcoin** cryptographically verifies the source-chain tx and its `LoanRepaid` event. The loan source is mock; the Attestcoin path is real.

## Why Attestcoin is required

Repayment lives on Sepolia; credit decisions live on Creditcoin. Attestcoin is the only on-chain source of truth that the Sepolia tx existed, succeeded (`receiptStatus == 1`), and emitted our event before score / cap / NFT update.

## Live app (convenience) vs proof (source of truth)

- **Desk:** https://kohap.github.io/credit-passport/ — only submit this URL once it loads **Connect wallet** (not README/404). Local: `npm run dev:web`.
- **Proof of Attestcoin:** `npm run prove -- <sepoliaTx> --submit` (CLI). Browser prove can CORS-fail; CLI is what you record if Pages is flaky.

> Pages: **Settings → Pages → Source: GitHub Actions**. Do not put a 404 in DoraHacks “Prototype Demo Video URL.”

## Hackathon proof (fill after live E2E)

| Artifact | Value |
| --- | --- |
| Sepolia `LoanRepaid` tx | **TBD** |
| Creditcoin `proveRepayment` tx | **TBD** |
| Passport tokenId | **TBD** |

Paste the worker’s `HACKATHON PROOF` block here after `npm run prove -- <tx> --submit`.

## Deployed addresses

Demo deployer: [`0x3953A716DA94e51EAFE6F2224379332B0BEEE5EA`](https://creditcoin-testnet.blockscout.com/address/0x3953A716DA94e51EAFE6F2224379332B0BEEE5EA)

| Contract | Network | Address |
| --- | --- | --- |
| MockUSD | Sepolia | [`0x5D695DD7bd61D22731973F32e84c8D797FEed701`](https://sepolia.etherscan.io/address/0x5D695DD7bd61D22731973F32e84c8D797FEed701) |
| MockMarket | Sepolia | [`0xEd2a52496044771bE1a3583f2d7061da33427a6a`](https://sepolia.etherscan.io/address/0xEd2a52496044771bE1a3583f2d7061da33427a6a) |
| MockUSD | Creditcoin | [`0x5D695DD7bd61D22731973F32e84c8D797FEed701`](https://creditcoin-testnet.blockscout.com/address/0x5D695DD7bd61D22731973F32e84c8D797FEed701) |
| CreditScore | Creditcoin | [`0xEd2a52496044771bE1a3583f2d7061da33427a6a`](https://creditcoin-testnet.blockscout.com/address/0xEd2a52496044771bE1a3583f2d7061da33427a6a) |
| CreditLine | Creditcoin | [`0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e`](https://creditcoin-testnet.blockscout.com/address/0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e) |
| PassportNFT | Creditcoin | [`0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e`](https://creditcoin-testnet.blockscout.com/address/0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e) |
| CreditPassportASC | Creditcoin | [`0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb`](https://creditcoin-testnet.blockscout.com/address/0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb) |

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
cp .env.example .env   # set SEPOLIA_* + CREDITCOIN_* keys (funded)
npm install
bash scripts/fund-creditline.sh          # once — mUSD liquidity on CreditLine
bash scripts/demo-e2e.sh                 # faucet → open → repay → prove --submit
# copy HACKATHON PROOF block into the table above
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

## Scoring (v1)

- +40 first verified repayment
- +20 each additional verified repayment
- +10 if `remainingDebt == 0` (loan closed)
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

# Foundry deps (once per machine)
cd packages/contracts-sepolia
forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.0.2
cd ../contracts-creditcoin
forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.0.2
npm install @gluwa/asc-contracts@0.2.1
cd ../..

# Unit tests (no live precompile required)
cd packages/contracts-sepolia && forge test
cd ../contracts-creditcoin && forge test
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

`CREDITCOIN_PASSPORT_ASC` defaults to `0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb`.

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

MIT
