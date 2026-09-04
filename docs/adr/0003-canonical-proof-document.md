# ADR-0003 — Canonical proof document (do before submission)

## Status

Accepted · 2026-09-04 · implemented (flat `--json-out`)

## Context

Worker `--json-out` nests `proof.merkleProof`; Desk wants flat `ProofPayload`. `parsePastableProof` is a shallow bandage.

## Decision

**Do now** (in existing files only): worker emits a flat, `proveRepayment`-ready proof document (same fields as `ProofPayload`). Desk accepts that shape first; keep a thin nested fallback for one release if needed, then delete.

## Consequences

- CLI paste path becomes reliable for judging.
- Enables later ProofAcquisition deepening without inventing a third shape.
