# BigChange Academy Hub — accessibility navigation polish (M5.15)

This milestone improves keyboard and screen-reader navigation in the public fictional prototype without changing its data or authentication boundaries.

## Included
- A keyboard-visible “Skip to main content” link.
- A focusable main landmark target so keyboard users can bypass the sidebar.
- Breadcrumb navigation with a named landmark and current-page marker.
- Decorative navigation glyphs hidden from assistive technology.
- A short hint for the horizontally scrollable section menu on small screens.
- Reduced-motion handling includes the skip-link transition.

## Manual acceptance checklist — not run
1. Load the public fictional preview and press Tab; confirm the skip link appears first.
2. Press Enter on the skip link; confirm focus moves to the main content.
3. Navigate section buttons with the keyboard and confirm focus indicators remain visible.
4. Use a screen reader to confirm decorative glyphs are not read as labels and the breadcrumb has a name.
5. At a narrow viewport, confirm the sideways-scrolling section menu and its hint are visible.
6. Enable reduced motion and confirm the skip link does not animate.
7. Confirm the secure pilot and public Pages deployment remain unchanged.

## Boundaries
- This is a code-level accessibility improvement, not a full WCAG audit.
- No real learner data, backend, auth, deployment or Supabase changes.
