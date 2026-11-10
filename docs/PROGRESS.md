# Progress log (audit and finish pass)

Baseline (branch tip M5.15, `60ebf49`): typecheck OK, 97/97 tests, build OK.

## Done in this pass
- Fee status now includes **Overdue** (unpaid/partial and fee month already ended; assumption until the school defines due dates). `src/lib/finance.mjs`.
- Finance → **Reminder queue**: lists outstanding fees, copies reminder text for staff to send manually. Shows "Not sent · no integration". Nothing is sent. `src/components/AcademyReminders.tsx`.
- Tests: 102/102 pass; typecheck and build pass.

- Access-rules migration `20261031_0002` written and tested locally on PostgreSQL 16 (37/37 isolation checks); see `docs/ACCESS_RULES.md`. Not yet applied to Supabase.

- Live slice 1 (`src/live/`): after sign-in, admin gets Students (add/search/edit/deactivate), Courses, Classes (create, roster, enroll/remove); teacher gets read-only own students/classes. Tested: validation unit tests only; **not yet exercised against the real Supabase project** (network blocked here).

- Live slice 2: attendance. Live slice 3: guardian contacts and parent-level 3-month payment periods in USD (teacher reports, finance checks, admin approves; migration 0003, 77/77 local DB checks, 118 JS tests). Not yet run against the real Supabase project; migration 0003 not yet applied by the owner.
- Live slice 4: role Overview dashboards, read-only parent (children, attendance, payments) and student views, copy-only overdue reminder texts, admin reassigns a class teacher, `supabase/manual/link_login.sql` to attach a parent/student login to their record (tested locally). 120 JS tests pass.
- Browser smoke test `tests/e2e/live-smoke.mjs` (Playwright, fake Supabase): 27/27 at first, 38/38 after the items below — admin course → student → class → enroll → attendance → guardian → fee period → report → check → approve; teacher and finance views; no horizontal scroll at 390px; no runtime errors.
- Parent directory (admin/finance: search, pending-verification filter, verify in place), edit course title/description, rename class, per-student attendance history (admin and teacher). Browser smoke test now 38/38; 122 unit tests.
- Self-review: fixed a guardian-contact privacy gap (migration 0004, 79/79 DB checks). Automated axe accessibility scan of all live screens: one contrast issue (breadcrumb) fixed; 50/50 browser checks incl. axe. **Owner must run migration 0004.**
- Real project (txwremmzgnmlnklpeton) probed from this session, not signed in: all 16 tables/views and every Academy function refuse anonymous access; migration 0003 is applied. **Public sign-up is ON** — owner should turn it off. `tests/live-project-check.mjs` checks admin/teacher/finance rules on the real project with the owner's test logins (run locally).
- Hosting prepared (not deployed): `netlify.toml`, security headers `public/_headers` (strict CSP), `docs/HOSTING.md`. Production build served with these headers passes the full browser smoke test (40/40, no CSP errors) and the demo loads cleanly.
- Owner checklist `docs/NEXT_STEPS.md` and `docs/MERGE_PLAN.md` written. Live project re-checked on 2026-11-08 after the owner's changes: email sign-in ON, public sign-up OFF.
- Deep audit 2026-11-09 (`docs/AUDIT_REPORT.md`): fixed silent 1,000-row truncation (paged loading), updated Vite 6.4.5 (0 vulnerabilities), retargeted pilot page; 126 unit, 79 DB, 52 browser checks pass.
- Owner decisions 2026-11-09: 14-day grace before Overdue; WhatsApp reminders for teachers and finance with recorded dates, consent enforced by the database and editable; finance reminder list + broadcast-number copy; weekly admin backup script. Migration 0005 (97/97 DB checks), 128 unit tests, 59/59 browser checks incl. axe. `tests/live-project-check.mjs` made strict (network errors now fail). **Owner must run migration 0005.**
- Owner decisions 2026-11-10: per-child 3-month periods from each child's start day; admin amount change with audited reason; free bulk email via the staff's own email app (BCC); teacher Notices (end of level + one-week break + next level) shared to WhatsApp groups; fixed a bug where recording WhatsApp permission cleared email permission. Migration 0006; 118/118 DB, 130 unit, 65/65 browser checks. **Owner must run migrations 0005 and 0006.**
- Class level dates (migration 0007): admin or the class's teacher sets level start/end; Overview "Levels ending soon" with Write notice; Notices prefilled; Move to next level (Level N → N+1, computer track Basic computer → Canva → Wix → WordPress → AI → CapCut) with dates after the one-week break, students stay. 128/128 DB, 131 unit, 70/70 browser checks. **Owner must run migrations 0005–0007.**
- Visual refresh (docs/DESIGN_SPEC.md, reviewed by EGM design and implementation-readiness reviewers): light sidebar with gold pill + bar, white rounded cards, gold hero card, black/white pill buttons, readable chips, scrolling tables, phone layout, new sign-in card. Scoped to the live app; demo pixel-identical before/after. axe now also scans sign-in and finance screens: 80/80 browser checks. Screenshots in docs/design/.
- Parent and student screens now in the browser test with axe (parent at phone width): 94/94. All migrations 0001–0007 confirmed live on the real project.

- 2026-11-10: pull request #19 opened to `main`. Re-ran everything on a clean checkout: 131 unit, 128/128 DB, 94/94 browser checks incl. axe, build OK. Database rule tests are now one command (`tests/sql/run_local.sh`, with `tests/sql/auth_stubs.sql`) and run in CI.
- 2026-11-10, review fixes (migration 0008): dates use Israel time (Asia/Jerusalem, where the admin works; teachers in Ethiopia are one hour ahead in winter); family-wide periods retired (only per-child periods can be started; old family periods stay as they are); every verified parent of a child sees that child's periods. 132/132 DB checks. **Owner must run migration 0008.**

## Remaining
Needs the owner:
0. Run migration 0008 (`docs/NEXT_STEPS.md` step 1c).
1. Merge pull request #19, then close drafts #1–#18 (`docs/MERGE_PLAN.md`).
2. Teacher test account, then `tests/live-project-check.mjs` with test logins (`docs/NEXT_STEPS.md` steps 2–3).
3. One manual run-through with fake names (step 4), including a Chromebook, a phone and a screen reader.
4. Hosting (`docs/HOSTING.md`); invitations need it.
5. Weekly backup and a second admin (`docs/BACKUPS.md`).
6. Privacy and safeguarding checklist before any real family data.

Known and not yet built:
- With two verified parents, the period is still stored on one of them (lowest id), so reminders go to that parent. Both now see it. Choosing the paying parent is not built.
- An old family-wide period that already counted a child is not detected when a per-child period is started for that child. Only matters for periods created before migration 0006 (test data).
- Messages are still sent by staff from their own WhatsApp/email; no provider is connected.
- Teacher logins are created by hand in the Supabase dashboard (a server-side invite needs hosting first).
- The browser test is not in CI (Playwright is not a project dependency).
