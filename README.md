# Credit Passport

**BUIDL CTC 2026 Fall · DeFi track · Attestcoin Protocol**

Prove that a borrower repaid (or closed) a loan on **Ethereum Sepolia**. Unlock a credit line, raise a borrow cap, and mint a soulbound **Credit Passport** NFT on **Creditcoin CC3 Testnet** — only after **Attestcoin** cryptographically verifies the source-chain transaction and its `LoanRepaid` event logs.

This is a **cross-chain underwriting primitive**, not a full lending market.

## Why Attestcoin is required (not optional)

Repayment happens on Sepolia. Credit decisions happen on Creditcoin. Attestcoin is the **source of truth** that the Sepolia tx existed, succeeded, and emitted our event:

1. User repays on Sepolia `MockMarket` → `LoanRepaid(...)`.
2. Worker/UI waits until that height is attested (`ProofBuilder.waitUntilHeightAttested`).
3. Hosted prover returns Merkle + continuity proofs (`getProof`).
4. `CreditPassportASC.proveRepayment` on Creditcoin calls precompile **`0x0000000000000000000000000000000000000FD2`** `verifyAndEmit`.
5. ASC decodes `txBytes` with official `EvmV1Decoder`, **requires `receiptStatus == 1`**, requires log emitter == trusted Sepolia MockMarket, requires borrower match, then updates score / cap / NFT.

No Chainlink, Pyth, or centralized “trust me” backend decides the repayment.

## Networks

| Network | EVM chainId | Attestcoin chainKey | RPC |
| --- | --- | --- | --- |
| Ethereum Sepolia | `11155111` | **`1`** (not the chainId) | `SEPOLIA_RPC_URL` |
| Creditcoin CC3 Testnet | `102031` | n/a (destination) | `https://rpc.cc3-testnet.creditcoin.network` |

- Explorer: https://creditcoin-testnet.blockscout.com/
- Attestor dashboard: https://dashboard.cc3-testnet.creditcoin.network/
- Proof builder: https://prover.cc3-testnet.creditcoin.network (fallback: `https://proof-gen-api.cc3-testnet.creditcoin.network`)
- ChainInfo precompile: `0x…0fd3`

**Pitfall:** `chainKey` ≠ EVM `chainId`. Sepolia’s chainKey on CC3 testnet is `1`.

## Scoring (v1)

- +40 first verified repayment
- +20 each additional verified repayment
- +10 if `remainingDebt == 0` (loan closed)
- Total score capped at **100**
- `borrowCap = 100 mUSD + (score × 2 mUSD)`

## Deployed addresses

Demo deployer: `0x3953A716DA94e51EAFE6F2224379332B0BEEE5EA`

| Contract | Network | Address |
| --- | --- | --- |
| MockUSD | Sepolia | [`0x5D695DD7bd61D22731973F32e84c8D797FEed701`](https://sepolia.etherscan.io/address/0x5D695DD7bd61D22731973F32e84c8D797FEed701) |
| MockMarket | Sepolia | [`0xEd2a52496044771bE1a3583f2d7061da33427a6a`](https://sepolia.etherscan.io/address/0xEd2a52496044771bE1a3583f2d7061da33427a6a) |
| MockUSD | Creditcoin | [`0x5D695DD7bd61D22731973F32e84c8D797FEed701`](https://creditcoin-testnet.blockscout.com/address/0x5D695DD7bd61D22731973F32e84c8D797FEed701) |
| CreditScore | Creditcoin | [`0xEd2a52496044771bE1a3583f2d7061da33427a6a`](https://creditcoin-testnet.blockscout.com/address/0xEd2a52496044771bE1a3583f2d7061da33427a6a) |
| CreditLine | Creditcoin | [`0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e`](https://creditcoin-testnet.blockscout.com/address/0xFA2f6AD61e9A1c44eD03509f386DE4DDa5ecfa7e) |
| PassportNFT | Creditcoin | [`0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e`](https://creditcoin-testnet.blockscout.com/address/0x3E6CB0dC03e72E57ac91c8D74cF2246079F1B09e) |
| CreditPassportASC | Creditcoin | [`0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb`](https://creditcoin-testnet.blockscout.com/address/0xc5c9B5A4842B20D945aAD6824A58Afdbb78fecbb) |

JSON: `packages/*/deployments/*.json`.

> Same hex for Sepolia MockUSD ↔ CC3 MockUSD (and Sepolia MockMarket ↔ CC3 CreditScore) is a CREATE-address coincidence from matching deployer nonces — different chains.

## Repo layout

```
packages/contracts-sepolia/     MockUSD + MockMarket (LoanRepaid)
packages/contracts-creditcoin/  ASC + score + line + soulbound NFT
packages/worker/                prove.ts CLI (@gluwa/usc-sdk)
apps/web/                       Next.js dual-chain desk
docs/ARCHITECTURE.md
scripts/demo.sh
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
- **tCTC:** Creditcoin Discord faucet channels (join https://discord.gg/creditcoin — use the CC3 testnet faucet channel; ask mods if the channel name moved).
- **mUSD:** `MockUSD.faucet()` on Sepolia from the UI.

## Worker proof CLI

```bash
# After a Sepolia repay tx:
npm run prove -- 0xSEPOLIA_TX_HASH --json-out /tmp/proof.json
# Optional broadcast (needs CREDITCOIN_PRIVATE_KEY + CREDITCOIN_PASSPORT_ASC):
npm run prove -- 0xSEPOLIA_TX_HASH --submit --claim 0xYourAddress
```

## Web UI

```bash
npm run dev:web
# http://localhost:3000
```

Demo path (&lt; 90s): connect → Add networks → Faucet → Open loan → Repay → Prove on Creditcoin → see score / cap / NFT.

## Attestcoin step-by-step (judge checklist)

1. Source event is **not** a generic ERC-20 `Transfer`; it is `LoanRepaid(borrower, loanId, amount, remainingDebt, timestamp)`.
2. `waitUntilHeightAttested(1, blockNumber)` — attestation intentionally lags head (~15s) to avoid reorgs.
3. `getProof(txHash)` → `txBytes`, merkle siblings, continuity roots.
4. On-chain: `verifyAndEmit` @ `0xFD2`.
5. ASC requires `receiptStatus == 1` (precompile does **not** check success).
6. ASC requires log emitter == immutable Sepolia MockMarket.
7. Replay protection: query id from `(chainKey, blockHeight, txIndex)`.
8. Business logic in the **same transaction**: score → cap → soulbound NFT.

## Limitations

- Attestcoin **readability only** this season (no writability / no sending Sepolia txs through Attestcoin).
- Attestation lag; proof gen can take minutes if the height is not yet attested.
- Mock loans / mock USD — not production underwriting.
- Live `0xFD2` verification only works on Creditcoin CC3 testnet (unit tests mock / skip the precompile path).

## Attribution

- Proof / ASC patterns follow official Gluwa examples and `@gluwa/asc-contracts` (`ASCBase`, `EvmV1Decoder`, `INativeQueryVerifier`).
- SDK: `@gluwa/usc-sdk`.
- References: https://github.com/gluwa/usc-testnet-bridge-examples · https://github.com/gluwa/attestcoin-protocol-examples

## License

MIT
