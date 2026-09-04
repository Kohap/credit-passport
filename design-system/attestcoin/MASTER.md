# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.

---

**Project:** Credit Passport (Attestcoin)
**Updated:** 2026-09-04 (pols.dev/slop pass)

---

## Brand constraints

No purple. No Fraunces / Inter / Space Grotesk / Cormorant. No gradient text. No entrance
animations that start at `opacity: 0`. No filled+ghost CTA pairs. No hover lift on buttons.
No crude SVG product mocks. No mono costume on labels.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background | `#08110e` | `--bg0` |
| Lift | `#101c18` | `--bg1` |
| Text | `#e6f0ea` | `--ink` |
| Muted | `#8b9c93` | `--mute` |
| Line | `#24352e` | `--line` |
| Accent (tonal) | `#7a9e90` | `--accent` |
| Accent strong | `#c5ddd2` | `--accent-strong` |

## Typography

- **Brand / display:** system serif stack (`Iowan Old Style` / Palatino / Georgia) — not Google shelf
- **UI / body:** IBM Plex Sans (quiet body only)
- **Data only:** system mono (`ui-monospace` / SF Mono) for hashes and fields — never labels

## Layout

1. Landing hero: oversized brand owns the fold; one headline; one CTA (no ghost twin).
2. Desk at `/app` with compact chrome.
3. Content always visible (no opacity-gated entrance).
4. Prefer spacing over decorative hairlines and accent bars.

## Anti-patterns (pols.dev/slop)

See https://pols.dev/slop.md — treat as law unless the user overrides.
