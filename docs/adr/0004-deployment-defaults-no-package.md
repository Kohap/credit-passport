# ADR-0004 — Deployment defaults stay in networks.ts + env adapters

## Status

Accepted · 2026-09-04

## Context

Addresses / prover URLs / explorers are duplicated across web, worker, scripts.

## Decision

**Do not** create a new shared deployment package before submission. Keep baked defaults in `apps/web/src/config/networks.ts` and mirrored literals in worker/scripts. Empty `NEXT_PUBLIC_*` must not wipe defaults (`pub()`). Revisit post-submission only if address drift causes a failed demo.

## Consequences

- Triplication remains accepted debt.
- `SCORE_FORMULA` stays UI copy; on-chain formulas remain source of truth.
