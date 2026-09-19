# Design — Wasap Hub (Daily Tracker)

A locked design system for Wasap Hub web app. Every page redesign reads this file before emitting code.

## Genre
modern-minimal

## Macrostructure family
Workbench — high-density data canvas, precision-bordered cards, clear status badges, minimal motion.

## Theme (Relief / Modern Slate Dual-System)
### ☀️ Light Mode (Warm Relief Cream)
- `--bg-canvas`: #f9f7f0
- `--bg-card`: #ffffff
- `--bg-subtle`: #f1ede1
- `--border-color`: #e7e5dc

### 🌙 Dark Mode (Obsidian Modern Slate - OKLCH)
- `--bg-canvas`: oklch(13% 0.012 260)
- `--bg-card`: oklch(16% 0.016 260)
- `--bg-subtle`: oklch(20% 0.020 260)
- `--border-color`: oklch(24% 0.016 260)
- `--text-title`: oklch(72% 0.17 160) (Signal Emerald)
- `--text-main`: oklch(98.5% 0.004 250) (Near White)
- `--pop-color`: oklch(62% 0.22 256) (Cobalt)

## Typography (2+1 Rule)
- Display: Plus Jakarta Sans 600–800, roman, tracking -0.02em
- Body: Inter 400–500, clean neutral
- Mono: JetBrains Mono (tabular figures for amounts, dates, status)

## Anti-Slop Discipline
- No blurry gradient text or gradient headlines.
- No saturated glowing shadows.
- Single-line compact affordances.
- Precise hairline borders.
