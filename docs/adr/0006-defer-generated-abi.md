# ADR-0006 — Defer generated ABI adapter

## Status

Accepted · 2026-09-04

## Context

Hand `abi.ts` and worker `ASC_ABI` are shallow extracts of the same surface.

## Decision

**Defer** forge-artifact generation until post-submission. Hand ABIs are acceptable while the ASC interface is frozen.

## Consequences

- Parallel ABI fragments remain.
- Revisit if a revert/event mismatch burns a demo.
