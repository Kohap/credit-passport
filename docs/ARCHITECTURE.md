# Architecture

## Overview

```mermaid
sequenceDiagram
  participant User
  participant Sepolia as Sepolia MockMarket
  participant Attestors as Attestcoin attestors
  participant Prover as ProofBuilder API
  participant ASC as CreditPassportASC (CC3)
  participant Score as CreditScore / Line / NFT

  User->>Sepolia: repay(loanId, amount)
  Sepolia-->>User: LoanRepaid log
  Note over Attestors: attestation lags head ~15s
  Attestors-->>Prover: height attested (chainKey=1)
  User->>Prover: waitUntilHeightAttested + getProof(txHash)
  Prover-->>User: txBytes + merkle + continuity
  User->>ASC: proveRepayment(...)
  ASC->>ASC: verifyAndEmit @ 0xFD2
  ASC->>ASC: receiptStatus==1 + LoanRepaid from trusted market
  ASC->>Score: applyRepayment / setCap / mintOrUpdate
  ASC-->>User: RepaymentVerified + PassportUpdated
```

## Packages

| Path | Role |
| --- | --- |
| `packages/contracts-sepolia` | Emit unambiguous `LoanRepaid` |
| `packages/contracts-creditcoin` | Verify proofs; own score/cap/NFT state |
| `packages/worker` | CLI proof generation (`@gluwa/usc-sdk`) |
| `apps/web` | Dual-chain desk + `/api/prove` |

## ASC security checks

1. `chainKey == 1` (Sepolia on CC3 testnet)
2. `verifyAndEmit` returns true
3. Replay: `processedQueries[keccak256(chainKey, height, txIndex)]`
4. `EvmV1Decoder` → `receiptStatus == 1`
5. Log signature `LoanRepaid(address,uint256,uint256,uint256,uint64)`
6. `log.address == sepoliaMockMarket` (immutable)
7. `log.borrower == msg.sender` (or explicit claim address equal to msg.sender)

## Official dependencies

- `@gluwa/asc-contracts` — `EvmV1Decoder`, `INativeQueryVerifier`
- `@gluwa/usc-sdk` — `ProofBuilder`, `PrecompileChainInfoProvider`
