# Visual refresh — design spec (live app)

Status: reviewed (EGM design critic + implementation readiness, 2026-11-11); decisions below supersede the draft where they differ · Scope: the signed-in **live** app (`src/live/`, `src/SecureApp.tsx` sign-in card). The older demo app is out of scope and must look unchanged.

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

---

## Decisions after review (these win over anything above)
**Scoping.** LiveApp's root is `className="shell live-shell"`; the sign-in/loading/error screens add `live-auth` to their `.auth-shell` (SecureApp, main.tsx). All new rules live in one block at the **end** of `styles.css`, every selector prefixed `.live-shell` or `.live-auth`. The old `.live .operations input/select` rules are replaced. Leaking global rules are reset inside `.live-shell`: table `min-width` (set 640 px), row striping and hover, `td` weight, `.quiet` (explanatory text becomes 14 px; overridden with matching `!important`), `button:disabled` opacity, and the phone rule hiding `.sidebar-bottom`. The demo is proven unchanged by before/after screenshots at 1366 and 390 px.

**Colour and contrast (measured).**
- Gold `#c8902f` is decoration only (gradients, small dots, borders that need not be seen). Never text, focus rings or required borders.
- Focus ring everywhere in the live app: 2 px solid `#7d5313`, 2 px offset (6.7:1 on white). Overrides the old nav focus colour.
- Input/select border `#8a8072` (≈3.9:1 on white); card edges and dividers keep `#e7e0d4`. Inputs are white, not muted.
- Active nav item: gold tint `#f6e7c8` pill **plus** a 3 px `#7d5313` bar on the left and bold text (a cue that is not only colour); `aria-current` kept.
- Hero card: gold gradient `#f6e7c8 → #efd39a`, **all text `#1f1b16`**. Hero = the first Overview card (admin: Active students · finance: Awaiting check · teacher: My classes); it keeps the `metric` class plus `metric-hero`.
- Chips (12 px / 600, padding 4×10 px, pill): green `#315f41` on `#deeadc`; amber (moved towards orange so it does not read as the brand gold) `#8a3d0a` on `#fde4cc`; red `#8a2a24` on `#f8e4e2`. Colour follows the existing `.tag.green|amber|red` classes.
- Secondary text `#6b6257`; never on the hero gradient.

**States.** Hover: pills darken one step (`#2d2822` primary, `#f7f4ee` secondary). Disabled: fill `#e7e0d4`, text `#6b6257`, no opacity change, `cursor: not-allowed`. Errors (`role="alert"`, `aria-invalid`): `#8a2a24` text on `#f8e4e2`; successes stay calm dark text. Loading: the existing "Loading…" status text in a muted card. Empty states: 14 px `#6b6257`. Text buttons (`.text-btn`): dark gold underline, at least 36 px tall (above the 24 px WCAG AA target minimum). Anchors styled as buttons (`a.small-btn`, `a.primary-btn`) look like buttons.

**Layout.**
- Headings stay inside their card (no restructure); the card is the white surface. `.people-enroll` blocks become muted inner panels (radius 14 px, `#faf8f4`, border `#e7e0d4`); `.finance-strip` tiles become white tiles with a border.
- Desktop: sidebar footer shows the signed-in email (ellipsis) and a role chip; **Sign out only in the top bar**. The top bar shows breadcrumb + email + Sign out.
- Phones (≤ 790 px): one compact row with a 40 px logo tile and the scrollable pill bar; top bar shows breadcrumb + Sign out only (email hidden); the live-database notice stays one short line. No horizontal page scroll.
- Logo tile: `#1f1b16`, radius 14 px, padding 12 px, logo 150 px wide on desktop / 40 px tile on phones; no drop-shadow. Same tile on the sign-in card.
- Tables: `.table-wrap` scrolls sideways inside its card, with `tabindex="0"`, `role="region"` and an `aria-label` so keyboard users can scroll it; muted header row, row dividers only, `vertical-align: top`, action cells `white-space: nowrap`; forms inside table cells use `width:auto`. Grid/flex children get `min-width:0`.
- Icons: inline SVG components in `src/live/icons.tsx` (`aria-hidden`, `focusable="false"`, `stroke="currentColor"`), one per section; no text glyphs (they would change button text). No arrow glyphs on buttons.
- Font: system stack including `"Noto Sans Ethiopic"` for Tigrinya/Amharic names; no downloaded fonts.

**Sign-in card.** Page `#f3efe8`; white card max 440 px, radius 20 px, padding 32 px (20 px on phones); logo tile; inputs as above; full-width black primary button; all states (checking, set password, signed out, not enrolled/error) share the card.

**Invariants.** `tests/e2e/live-smoke.mjs` passes unmodified: nav landmark "Sections" with plain-text buttons; four `.metric` cards on Overview; `.tag.green` "Paid"; exact button names (Report, View, Edit, Hide, …); headings and labelled regions/forms; implicit `<label>` wrapping; "Live database"; sign-in labels; no horizontal scroll at 390 px. axe: zero serious/critical on every screen it scans (admin and teacher screens, plus finance, guardian and sign-in added to the scan).

## Motion and fluidity (added 2026-11-11)
Goal: the live app should feel smooth, not jumpy. All of it is in one block at the end of `styles.css`, scoped as above, and switched off for people who ask their device to reduce motion.
- **Changing section:** the new screen rises 8 px and fades in over 0.2 s; Overview cards follow 20 ms apart. Total stays under 0.3 s.
- **Pressing and typing:** nav items, buttons, inputs and status chips change colour over 0.16 s; buttons shrink slightly while pressed; a focused input gets a soft gold ring in addition to the focus outline. Table rows tint on hover.
- **Staying oriented:** the top bar stays at the top while scrolling (lightly see-through); on wide screens the section list stays in place too. On phones the section bar snaps while swiping and keeps the chosen section in view.
- **Fluid sizes:** page padding, card padding, card corners, headings and big numbers scale with the screen width (`clamp`) instead of jumping at 790 px. Numbers in tables line up (`tabular-nums`).
- **Loading:** quiet placeholder cards shimmer under the "Loading…" text.
- **Saving feels quicker:** after a save the app reloads only what that save can change. Lessons and attendance marks (the largest lists) are reloaded only by the Attendance screen (`src/live/loadPlan.mjs`).
- Not animated on purpose: cards that cannot be clicked do not lift on hover.

