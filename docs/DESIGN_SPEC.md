# Visual refresh — design spec (live app)

Status: draft for review · Scope: the signed-in **live** app (`src/live/`, `src/SecureApp.tsx` sign-in card). The older demo app is out of scope and must look unchanged.

## Goal
Make the hub feel calm, modern and easy for school staff on Chromebooks (1366×768) and phones (390 px), inspired by two reference dashboards the owner liked: light page, generous white space, large rounded white cards, pill buttons and chips, a light sidebar with a pill highlight, black primary buttons, and one accent "hero" card. Keep the Big Change brand: warm beige, **gold** accent, gold logo.

## Owner decisions
- **Light sidebar** (replaces the dark sidebar of the original brief).
- **Accent: Big Change gold.** No rose or lavender.

## Visual language
| Token | Value | Use |
|---|---|---|
| Page background | `#f3efe8` (warm off-white) | behind everything |
| Surface | `#ffffff` | cards, sidebar, top bar |
| Surface muted | `#f7f4ee` | inputs, table header, inner panels |
| Border | `#e7e0d4` (1 px) | cards, inputs, dividers |
| Text | `#1f1b16`; secondary `#6b6257` (≥ 4.5:1 on white) | |
| Accent (gold) | `#c8902f`; gold tint `#f6e7c8`; dark gold text `#7d5313` | active nav pill, hero card, focus ring, small highlights |
| Primary button | `#1f1b16` background, white text, pill radius, optional "→" | the one main action per area (Save, Add, Start) |
| Secondary button | white, 1 px border, pill radius, dark text | other actions |
| Status chips | pill, tinted background + dark text: green (paid), amber (unpaid/pending), red (overdue) | contrast ≥ 4.5:1 |
| Radius | cards 20 px, inner panels 14 px, inputs 12 px, pills 999 px | |
| Shadow | `0 1px 2px rgba(31,27,22,.04), 0 8px 24px rgba(31,27,22,.06)` | cards only |
| Type | system font stack (no web-font download); page title 28 px/600, card title 17 px/600, body 14 px, small labels 12 px | |
| Spacing | 8 px grid; card padding 24 px (16 px on phones); gap between cards 20 px | |

## Layout
- **Sidebar (light, 248 px):** logo on its own small dark rounded tile at the top (the gold logo needs a dark background), then the section list. Each item: small line icon + label; the current item is a **gold-tint pill** with dark gold text. Footer: signed-in email and role, Sign out. On phones the sidebar becomes a horizontal scrollable pill bar at the top (as today), no icons hidden.
- **Top bar (white, 64 px):** breadcrumb on the left; on the right the user's email and a secondary "Sign out" pill (moved from the top bar into the sidebar footer on phones only if it does not fit).
- **Content:** page heading (eyebrow label + title) outside the card; content in white cards.
- **Live-database notice:** slim, gold-tint rounded bar with a small dot, not a heavy box.
- **Overview:** the first metric becomes the **hero card** (gold gradient `#f6e7c8 → #efd39a`, dark text); the other metrics are white cards with a small label, a big number and one line of context. "Levels ending soon" is its own card with list rows and pill actions. Quick actions become secondary pills.
- **Tables:** no outer borders, muted header row, row dividers only, 12 px vertical padding, status as chips. Wide tables scroll inside their card, never the page.
- **Forms:** labels above fields, fields full-width up to 420 px, 44 px tall (touch-friendly), muted background, gold focus ring. Groups of related fields in a two-column grid on wide screens, one column on phones.

## Accessibility (must not regress)
- Text and chips ≥ 4.5:1 contrast; focus ring visible on every control (2 px gold + offset).
- Touch targets ≥ 44 px. Respect `prefers-reduced-motion` (no transitions).
- Icons are decorative (`aria-hidden`); labels stay as text.
- Automated axe scan of every live screen must stay at zero serious/critical issues.

## Constraints
- CSS only plus small markup changes (class names, icon spans); no new dependencies, no web fonts, works under the existing strict Content Security Policy.
- All new styles scoped under a `.live-shell` root so the demo app is unchanged.
- No functional changes: the browser smoke test (70 checks) must pass unchanged except for selectors that depended on old class names.

## Acceptance
- Before/after screenshots of Overview, Students, Classes, Fees and Notices at 1366 px and 390 px.
- axe: 0 serious/critical on every live screen; smoke test green; demo screens unchanged.
