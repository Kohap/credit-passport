# ADR-0005 — Do not reshape ASC post-verify modules before submission

## Status

Accepted · 2026-09-04

## Context

Score / cap / NFT are separate Ownable writers; UI mirrors score copy.

## Decision

**Reject for this submission.** Do not redeploy or merge apply-verified-repayment into a new on-chain module. Event layout and score formula stay frozen.

## Consequences

- Formula locality stays split until CEIP season.
- Avoids forced redeploy and explorer re-verification.
