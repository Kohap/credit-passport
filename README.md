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

Fill after deploy (also copy into `.env` / `NEXT_PUBLIC_*`):

| Contract | Network | Address |
| --- | --- | --- |
| MockUSD | Sepolia | _TODO after deploy_ |
| MockMarket | Sepolia | _TODO after deploy_ |
| MockUSD | Creditcoin | _TODO after deploy_ |
| CreditScore | Creditcoin | _TODO after deploy_ |
| CreditLine | Creditcoin | _TODO after deploy_ |
| PassportNFT | Creditcoin | _TODO after deploy_ |
| CreditPassportASC | Creditcoin | _TODO after deploy_ |

JSON placeholders: `packages/*/deployments/*.json`.

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
forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
cd ../contracts-creditcoin
forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
npm install @gluwa/asc-contracts@0.2.1
cd ../..

# Unit tests (no live precompile required)
cd packages/contracts-sepolia && forge test
cd ../contracts-creditcoin && forge test
```

## Deploy (needs keys — TODO for live credentials)

```bash
# 1) Sepolia
cd packages/contracts-sepolia
forge script script/Deploy.s.sol:DeploySepolia --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $SEPOLIA_PRIVATE_KEY

# 2) Export SEPOLIA_MOCK_MARKET from the deploy logs, then Creditcoin
cd ../contracts-creditcoin
forge script script/Deploy.s.sol:DeployCreditcoin --rpc-url $CREDITCOIN_RPC_URL --broadcast --private-key $CREDITCOIN_PRIVATE_KEY

# 3) Copy addresses into .env + apps/web NEXT_PUBLIC_* + deployments/*.json
```

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
