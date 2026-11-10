# Merge plan

`main` still holds only the first README commit (`37e4459`). All work lives on branches.

## Status
**Done on 2026-11-10.** Pull request #19 was merged into `main` with a merge commit and drafts #1–#18 were closed. Only step 4 (hosting) remains. The rest of this page is kept as a record.

## Current state
- 18 open **draft** PRs (#1–#18) form a stack: each one is based on the previous branch (`feature/initial-student-hub` → … → `feature/academy-accessibility-m5-15`).
- Branch `ccr-7b420966-pk4uiw` starts from the top of that stack (`feature/academy-accessibility-m5-15`, verified to be fully contained) and adds the live, database-backed app: about 35 further commits (access rules, live screens, attendance, guardians, parent payment periods, overviews, tests, hosting, docs).
- So this one branch contains **everything** in PRs #1–#18 plus the new work. CI is green on it.

## Recommended path (simplest, nothing lost)
1. Open **one** pull request: `ccr-7b420966-pk4uiw` → `main`. Review it as a whole (the README and `docs/PROGRESS.md` describe what is in it).
2. Merge it with a normal **merge commit** (keeps all history, including every commit from the 18 drafts).
3. Close PRs #1–#18 with a comment "Included in #19". Their branches can stay or be deleted later; nothing is lost because their commits are in `main`.
4. Point hosting (Netlify/Cloudflare) at `main`.

## Alternative
Merge the drafts one by one (#1 into `main`, retarget #2 to `main`, merge, …) and then the new PR. Same end result, 19 reviews instead of 1; only worth it if you want to review each milestone separately.

## Before merging
- CI green on the PR (type-check, unit tests, build, database rule tests).
- Migrations 0001–0008 applied in Supabase and the verify script matching (16 tables, 43 policies). 0001–0007 confirmed live; 0008 still to run.
- `tests/live-project-check.mjs` passing with your test logins.
