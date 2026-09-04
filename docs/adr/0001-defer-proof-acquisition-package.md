# ADR-0001 — Defer shared ProofAcquisition package until after live prove

## Status

Accepted · 2026-09-04

## Context

`buildProof.ts` and `prove.ts` duplicate attest → getProof → map. A deep ProofAcquisition module would raise locality and leverage.

## Decision

**Defer** extracting a shared package / workspace module until after a live `proveRepayment` tx is on explorers. Until then, only unify the **proof document** shape (#3) inside existing files.

## Consequences

- No new package before submission.
- Dual retry loops remain temporarily.
- `parsePastableProof` shrinks or dies when shapes unify.
