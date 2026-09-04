# Landing page override

**Route:** `/` (`apps/web` Landing)

## Purpose

Product entry for Credit Passport. Convert visitors into the Attestcoin demo Desk at `/app`.

## References

Lido (single primary CTA), Aave (quiet utility chrome), Spark (numeric/section clarity) — see `references.md`. Keep forest/mint brand; no purple.

## Structure

1. **Hero (first viewport only)** — Brand “Credit Passport”, one headline, one supporting sentence, one CTA (Open Desk). Full-bleed Visual Vault–inspired forest supervisual with feathered mask into `--bg0` — not an inset card.
2. **Problem** — Cross-chain repayment is hard to prove without oracles.
3. **How it works** — Three linear steps (Repay → Prove → Unlock); no card grid.
4. **Close CTA** — Open Desk again over lake/pagoda supervisual, soft-masked into page color.
5. **Footer** — Chains / docs / Attestcoin note.

## Supervisuals

Theme-matched cinematic backgrounds (dark forest / mint haze) adapted from Visual Vault
(Ameer Talha) language so they sit on `#08110e` without light-blue chinoiserie clash.
CSS custom properties in `apps/web/src/app/visuals.css` (imported only on `/`).
JPEG copies also live under `apps/web/public/visuals/` for local preview.
Hero: `--visual-hero-forest`. Close: `--visual-hero-lake`.

## Anti-patterns on this page

- Stats, schedules, or badge clusters in the hero
- Card soup
- Demo wallet controls (those live on `/app`)
