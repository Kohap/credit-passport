# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.

---

**Project:** Credit Passport (Attestcoin)
**Generated:** 2026-09-04
**Category:** Fintech / Cross-chain credit proof

---

## Brand constraints (overrides ui-ux-pro-max defaults)

ui-ux-pro-max suggested gold + purple for generic fintech. **Do not use purple.**
Attestcoin / Credit Passport keeps a deep forest + mint identity already used on the live Desk.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background deep | `#071210` | `--bg0` |
| Background lift | `#0e1c18` | `--bg1` |
| Atmosphere | `#16352c` | `--bg-glow` |
| Text | `#e8f5ef` | `--ink` |
| Muted | `#8aa399` | `--mute` |
| Line | `#1f3a31` | `--line` |
| Accent / CTA | `#2dd4bf` | `--accent` |
| CTA fill | `#1f6b5c` → `#2f8f7c` | `--btn-primary` |
| OK | `#7fd99a` | `--ok` |
| Warn | `#e8c56a` | `--warn` |
| Bad | `#f07178` | `--bad` |

## Typography

- **Brand / display:** Fraunces (expressive serif — not Inter/system)
- **UI / body:** IBM Plex Sans (fintech trust from ui-ux-pro-max)
- **Data / hashes:** IBM Plex Mono

## Layout principles

1. First viewport = one composition: brand, one headline, one lede, one CTA group, atmospheric plane.
2. No stats, chain badges, or formula lists in the hero.
3. Demo is a linear 3-step flow (Sepolia → Prove → Unlock), with a visible step indicator.
4. Prefer section rhythm + hairlines over card grids. Interactive clusters may use a light panel only when it aids the action.
5. Motions: hero fade-up, active-step pulse, button hover (150–250ms). Respect `prefers-reduced-motion`.
6. Visible `:focus-visible` rings on all controls.

## Anti-patterns

- Purple / indigo gradient themes
- Warm cream + terracotta AI cliché
- Pill badge clusters in the hero
- Card soup / dashboard chrome on the landing Desk
- Emoji as icons
- Removing focus outlines

## Stack

Next.js 15 App Router + wagmi. CSS variables in `globals.css` (no Tailwind in this app).
