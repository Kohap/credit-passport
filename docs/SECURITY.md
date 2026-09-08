# Security and threat model

Credit Passport is an experimental testnet demo, not a production lending protocol or a completed third-party audit. This document records the checks that are active in the live v2 credit path and how they are exercised in the repository tests.

## What a verified repayment must satisfy

`CreditPassportASC.proveRepayment` updates a score, a credit cap, and the soulbound Passport only after all of these checks pass:

| Risk | On-chain control |
| --- | --- |
| A proof from the wrong source network | Requires Sepolia's Attestcoin `chainKey` of `1`. |
| A fabricated or invalid proof | Calls Attestcoin `verifyAndEmit` before processing the receipt. |
| Reusing the same source transaction | Stores and rejects each calculated proof query ID. |
| A reverted Sepolia transaction | Requires `receiptStatus == 1`. |
| A lookalike repayment event | Requires the configured Sepolia `MockMarket` emitter and exact `LoanRepaid` signature and topics. |
| Crediting a different wallet | Requires the receipt borrower, claim borrower, and transaction sender to match. |
| Crediting a partial repayment | Requires the event's remaining debt to be zero. |
| Crediting one loan twice | Stores each borrower and loan ID after its first successful credit. |

The live contract addresses and a successful end-to-end proof are listed in the root README.

## Demo source controls

The Sepolia `MockMarket` is deliberately constrained for a repeatable testnet demo:

- Each wallet can open one demo loan.
- Only the recorded borrower can repay it.
- Repayments cannot exceed the outstanding debt.
- The market emits the repayment event only after the token transfer succeeds.
- Only the MockUSD owner can mint market inventory.

## Credential and credit controls

- `CreditScore` accepts updates only from its configured writer.
- `CreditLine` accepts cap updates only from its configured updater and uses safe ERC-20 transfers.
- `PassportNFT` is non-transferable and mints or updates only through its configured minter.
- The separate Agent Passport escrow uses role checks and reentrancy protection around payment release.

## Verification commands

```bash
npm run security:check
npm run test:contracts
npm run build:web
```

The tests cover the one-loan guard, faucet and repayment behavior, unauthorized repayment, agent escrow roles, score progression, score cap, event signature, source chain key, and Passport non-transferability. Live Attestcoin verification is demonstrated by the linked CC3 transaction because its precompile exists only on Creditcoin CC3 testnet.

## Operational boundaries

- This project uses mock assets and mock lending. It must not be used for real lending or a real credit decision.
- Attestation and proof availability depend on public Creditcoin testnet services. The Desk rotates between two hosted proof services and retains a proof locally once it is ready.
- The public MCP endpoint is read-only, rate limited, size limited, and never receives a private key or sends a transaction.
- Wallet-provider dependencies currently contain moderate upstream advisories with no npm fix. The application has no high or critical production dependency advisory under `npm audit --omit=dev --audit-level=high`.
