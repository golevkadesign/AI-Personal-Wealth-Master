# Aperture Wealth Design System

This document defines the visual migration target for the wealth terminal UI.
Each migration slice should remain independently runnable and reviewable.

## Visual Direction

The target style is a matte professional dashboard: near-black surfaces, mist-green accent panels, thin borders, quiet status color, large financial numbers, and minimal glow.

Avoid returning to the old dark-gold terminal language unless a legacy component has not yet been migrated.

## Token Limits

- Base color: one near-black base, surfaced by opacity.
- Surface levels: 4 maximum.
- Accent colors: 4 maximum.
- State colors: 4 maximum.
- Type scale: 5 sizes maximum.
- Radius scale: 4 sizes maximum.
- Icons: Google Material Symbols Rounded only for functional UI icons.

## Core Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--aw-surface-0` | `rgb(18 20 19 / 1)` | App background |
| `--aw-surface-1` | `rgb(18 20 19 / .86)` | Cards and panels |
| `--aw-surface-2` | `rgb(18 20 19 / .64)` | Raised controls |
| `--aw-surface-3` | `rgb(18 20 19 / .28)` | Hover and subtle fills |
| `--aw-accent-mist` | `#DDE8D8` | Primary action and light panels |
| `--aw-accent-sage` | `#AEBEAA` | Secondary accent |
| `--aw-accent-line` | `#7F8F7D` | Chart and connection lines |
| `--aw-accent-ink` | `#202820` | Active dark-green fill |

## Type Scale

| Token | Size | Use |
| --- | --- | --- |
| `--aw-text-caption` | `11px` | Status, badges, chart labels |
| `--aw-text-body` | `13px` | Body, menus, compact rows |
| `--aw-text-label` | `16px` | Module titles and important labels |
| `--aw-text-title` | `24px` | Page and drawer titles |
| `--aw-text-metric` | `40px` | Financial numbers and percentages |

## Migration Rules

Do not introduce new hardcoded `#hex`, `text-[...]`, `rounded-[...]`, or `shadow-[...]` values in migrated files.

Use `aw-*` primitives from `src/index.css` for new UI work:

- `aw-panel`
- `aw-panel-muted`
- `aw-panel-accent`
- `aw-button`
- `aw-button-primary`
- `aw-button-ghost`
- `aw-status-pill`
- `aw-status-dot`

Use `src/components/ui/MaterialIcon.tsx` for all migrated functional icons.

## First Slice

The first migrated slice is `TerminalHeader`. It demonstrates:

- Material Symbols icons.
- Matte black header surface.
- Mist-green primary action.
- Tokenized status pills.
- No hardcoded colors, arbitrary text sizes, arbitrary radius, or glow shadows in the migrated file.

## Migration Status

Completed in the 7-step migration:

- Token foundation and `aw-*` UI primitives in `src/index.css`.
- Google Material Symbols Rounded import and `MaterialIcon` wrapper.
- Main app shell, terminal header, public holdings, chart cards, timelines, goal tracker, profile report, settings modal, chat drawer, chat UI, and developer view.
- Auth terminal layout replaced with the new black/mist-green shell.
- ECharts option defaults consolidated through `chartTokens`.
- `lucide-react` removed from app dependencies.
- Remaining large legacy AI-renderer components now route their old icon component names through `MaterialIconCompat`, which renders Material Symbols and keeps the app stable while those files are gradually simplified.

Validation snapshots:

- `http://localhost:3000/?test=1`
- Dashboard: `/tmp/wealth-aw-final-step7-dashboard.png`
- Chat drawer: `/tmp/wealth-aw-final-step7-drawer.png`
- Developer view: `/tmp/wealth-aw-dev-step6-state.png`, `/tmp/wealth-aw-dev-step6-pipeline.png`

Current non-blocking style debt:

- Some large legacy renderers still contain old hardcoded layout classes for specialized generated content and portfolio intelligence drawers. They no longer depend on `lucide-react`, but should be migrated from compatibility styles to direct `aw-*` primitives in a later refinement pass.
- Google sign-in keeps the official Google brand SVG colors by design; this is a third-party brand mark, not part of the app functional icon system.
- Firebase permission warnings are present in the local `test-user` environment and are unrelated to the visual migration.
