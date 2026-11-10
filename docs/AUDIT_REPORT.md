# BigChange Academy Hub — audit report

Date: 2026-11-09 · Branch: `ccr-7b420966-pk4uiw` · Supabase project: `txwremmzgnmlnklpeton`

## Verdict
The live, database-backed app is **feature-complete for a supervised test phase** with test data. Security rules are enforced in the database and pass every automated check, including on the real project for signed-out users. It is **not yet ready for real families**: it has not been checked with real staff logins on the real project, it is not hosted, and the privacy checklist is not done.

## What was examined
- All application code: the live app (`src/live/`, `src/SecureApp.tsx`, about 1,900 lines including SQL), the older demo app, and configuration.
- Database migrations 0001–0004, the setup scripts and the access rules.
- Dependencies (`npm audit`), build output, CI.
- The real Supabase project, from outside, as a signed-out visitor (read-only probes).

## Test results (all run on 2026-11-09)

| Check | Result |
|---|---|
| TypeScript type-check | Pass |
| Unit tests (`npm test`) | 126 / 126 |
| Production build | Pass (largest bundle 290 kB, 74 kB gzipped) |
| Database rule tests on a throwaway PostgreSQL 16 (`tests/sql/run_rls_tests.sh`) | 79 / 79 |
| Database layout check after 0001–0004 | 15 tables, all with forced RLS, 42 policies, 0 tables without a policy, 0 policies open to anonymous users |
| Browser test of the live screens against a fake Supabase, with axe accessibility scan (`tests/e2e/live-smoke.mjs`) | 52 / 52 |
| Same browser test on the production build with the strict security headers | 40 / 40, no blocked-content errors |
| Real project, signed out (`tests/live-project-check.mjs` + probes) | Every table, view and Academy function refuses access |
| Real project auth settings | Email sign-in ON, public sign-up OFF |
| Dependency vulnerabilities (`npm audit`) | 0 |
| GitHub Actions CI on this branch | Green (last checked run) |

**Not tested:** signed-in roles on the real project (needs the owner's test passwords; script provided), real Chromebooks and phones, screen readers (an automated scan is not a full accessibility review), load with real data volumes.

## Problems found and fixed

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | High (privacy) | A teacher could type a known parent phone number, get linked (pending) and immediately read that parent's name and email. | Migration 0004: teachers see contact details only after an admin verifies the link. Applied by owner. |
| 2 | High (correctness) | Lists were loaded in one request; Supabase returns at most 1,000 rows. Attendance passes that within months, so totals and rates would silently become wrong. | All lists now load page by page (`src/live/paging.mjs`), with stable ordering. 4 new tests. |
| 3 | High (access) | Public sign-up was ON in the real project; later email sign-in was accidentally switched OFF. | Owner fixed both; verified from here. |
| 4 | Medium | Payment status could be approved by finance / changed without trace (early design). | Teacher reports → finance checks → admin approves, enforced by a database trigger; every change audited; changing a report resets approval. |
| 5 | Medium | Siblings created duplicate parent records, breaking the family fee rule. | One parent per phone/email (unique indexes); adding an existing number links instead of duplicating. |
| 6 | Medium | Dev tool Vite 6.4.4 had a moderate advisory (dev server file access). | Updated to 6.4.5. Dev server only ever ran on 127.0.0.1. |
| 7 | Low | Breadcrumb text contrast 4.47:1, below the 4.5:1 standard. | Darkened; axe scan clean on every screen. |
| 8 | Low | Old pilot page and two docs pointed at a previous Supabase project. | Pilot points at the current project; old docs marked historical. |
| 9 | Low (process) | Owner's email was committed into a setup script via a GitHub web edit, breaking its safety check. | Template restored; the email remains in public Git history (owner to decide). |

## How access is enforced
Authorization is in the database (Row Level Security), not in the screens. Signed-out visitors get nothing. Teachers see only their own classes and students, cannot read the fee or parent tables directly, and can act on payments only for parents of their own students through checked functions. Finance cannot approve; only an admin can, and only what finance checked. Records are deactivated, never deleted. The audit table is append-only. The browser only ever holds the publishable key; the app rejects secret keys. Security headers restrict the hosted page to its own files and Supabase.

## Open risks (ranked)
1. **Signed-in roles not yet verified on the real project.** Run `tests/live-project-check.mjs` with test admin and teacher logins.
2. **No real-world use yet.** One full manual run-through by the owner is still pending.
3. **Not hosted.** Teachers cannot use it from their own devices; invitations cannot work. Guide: `docs/HOSTING.md`.
4. **Privacy and safeguarding review not done** (`docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`). Children's and parents' data must wait for it.
5. **Backups.** The free Supabase plan has limited backups and pauses inactive projects. Before real data, decide on a backup routine (or a paid plan).
6. **Fee amount is fixed when a period starts.** A child added mid-period does not change that period's amount. Policy decision pending.
7. **Overdue uses UTC dates.** In Ethiopia (UTC+3) a period can show overdue up to 3 hours early or late around midnight. Minor.
8. **No message sending.** Reminders are copy-and-paste; sending needs a provider and recorded consent.
9. **Single admin.** If the only admin loses access, recovery is through the Supabase dashboard. A second admin account is advisable.

## Readiness by area

| Area | State |
|---|---|
| Students, parents, courses, classes, enrollment | Done, tested (fake data) |
| Attendance (record, correct, summaries, per-student history) | Done, tested (fake data) |
| Parent payments (USD 150/100 rule, periods, report → check → approve, overdue, reminders) | Done, tested (fake data + DB rules) |
| Role screens (admin, teacher, finance, parent, student) | Done; parent/student need `link_login.sql` |
| Database security | Done, tested locally and (signed out) on the real project |
| Hosting | Prepared, not deployed |
| Real-data readiness | Not yet (privacy review, backups, owner testing) |

## Recommended next steps
Follow `docs/NEXT_STEPS.md`: teacher test account → `tests/live-project-check.mjs` → manual run-through → hosting → merge (`docs/MERGE_PLAN.md`) → privacy checklist → second admin and a backup routine → real data.
