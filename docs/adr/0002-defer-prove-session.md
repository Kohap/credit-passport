# ADR-0002 — Defer Desk prove-session extraction until after submission

## Status

Accepted · 2026-09-04

## Context

`Desk.tsx` owns faucet/open/repay/prove/paste/borrow; prove phases sniff status strings.

## Decision

**Defer** pulling a ProveSession module out of Desk until post-submission. Optional micro-fix (structured progress events) only if CORS/phase badge is broken in the recorded demo.

## Consequences

- Desk stays a multi-job module through judging.
- Regex phase sniffing remains a known shallow seam.
