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
- 2026-11-10, review fixes (migration 0008): dates use Israel time (Asia/Jerusalem, where the admin works; teachers in Ethiopia are one hour ahead in winter); family-wide periods retired (only per-child periods can be started; old family periods stay as they are); every verified parent of a child sees that child's periods. 132/132 DB checks. Owner ran migration 0008 on 2026-11-10 ("Success").
- 2026-11-10: pull request #19 merged into `main`; drafts #1–#18 closed. Follow-up: the paying parent is now the first parent linked to the child (added to migration 0008), which also removes a random failure in the database tests.

- Browser test now runs in CI (`browser` job): Playwright and axe-core are dev-only dependencies; `npm run test:e2e` runs it locally against a fake database (94/94, incl. accessibility scan of every role).

- Internal staff tool first. Google sign-in button for staff (only admin-added accounts; explains when Google is not switched on or the account was not added). Payment methods = the school's real channels, editable by the admin (migration 0009); optional USD amount on payment reports; Tigrinya help text on teacher forms (`src/live/ti.mjs`, drafts marked for a teacher to check). 147/147 DB checks, 131 unit tests, 100/100 browser checks. **Owner must run migration 0009** and, for Google, follow docs/GOOGLE_SIGNIN.md.

- Fees → **Download payments (CSV)** for finance/admin: opens in Google Sheets/Excel; formula-looking cells are neutralised; a privacy reminder sits next to the button. 132 unit tests, 101/101 browser checks.

- 2026-11-15, finish pass for the internal staff version. Re-ran everything: type-check, 132 unit tests, 150/150 database checks (17 tables, 46 policies), 101/101 browser checks incl. accessibility scan, and 76/76 browser checks on the production build served with the hosting security headers (no blocked content; demo build also loads cleanly). Fixed: Playwright (test tool only) updated to 1.63.0, `npm audit` back to 0; invitation screen no longer says "test"; README setup now clones `main` and lists migration 0009; hosting guide explains that Supabase's built-in email does not deliver invitations outside the organization (use Add user + Google sign-in); owner checklist rewritten (`docs/NEXT_STEPS.md`). No database change.

- 2026-11-17, **Staff screen** for the admin (migration 0010): lists every confirmed login that is not a student or parent; **Give a role** (teacher, finance, admin) to new logins, **Change role**, **Switch off / Switch on** access. Switched-off staff lose every right in the database (not just in the app). Refused: changing your own role or access, student/parent logins, unconfirmed logins, moving a teacher who still has classes. Staff changes are audited; class teacher pickers offer only staff whose access is on. 183/183 database checks (33 new), 132 unit tests, 109/109 browser checks incl. accessibility scan of the new screen. **Owner must run migration 0010.**

- 2026-11-21, **M6 step 1: installable phone app** (`docs/M6_PHONE_AND_STAFF_CHAT_PLAN.md`). Staff can add the Hub to their home screen: Android/Chrome shows an Install button, iPhone Safari shows the three Add to Home Screen steps (staff only; parents never see it; "Not now" is remembered). On phones the menu is a tab bar at the bottom. The offline helper stores only the app's own files, never school data, so the sign-in page opens without internet. No database change. 138 unit tests, 126/126 browser checks incl. axe.

- 2026-11-21, **M6 step 2: staff chat database** (migration 0011). One-to-one chats and automatic groups (All staff, Teachers, Finance, one per class) with membership worked out live from roles, class teachers and access; private by default; members can report a message, and the admin can then open that chat only through a function that records every opening; own messages can be deleted within 15 minutes unless reported; message text never goes to the audit trail; Realtime enabled for new messages. 244/244 database checks (61 new), safe to run twice. No screens yet. **Owner must run migration 0011.**

- 2026-11-21, **M6 step 3: Messages screen.** New **Messages** tab for admin, teacher and finance with an unread badge: chat list, chat view (phone: one pane at a time with Back), new one-to-one chat, members, Drive/https link cards, delete own message within 15 minutes, report a message; admin **Reported messages** list → open conversation (recorded) → mark handled. Live updates through Supabase Realtime plus a 60-second backstop. Before migration 0011 the screen explains instead of failing. Unit tests for the chat rules; browser checks for the whole teacher → finance → admin flow with accessibility scans.

## Remaining
The code for the internal staff version is finished. Needs the owner, in order (`docs/NEXT_STEPS.md`):
0. Run migration 0010 (Staff screen).
1. Hosting (`docs/HOSTING.md`), then Google sign-in (`docs/GOOGLE_SIGNIN.md`).
2. Add the staff logins and roles; `tests/live-project-check.mjs` with test logins.
3. One manual run-through with fake names, including a phone, a Chromebook and a screen reader.
4. Weekly backup and a second admin (`docs/BACKUPS.md`).
5. Privacy and safeguarding checklist before any real family data.

Migration 0009 is on the real project (confirmed 2026-11-17 with a signed-out check).

Known and not yet built:
- With two verified parents, the period is stored on the parent linked to the child first, so reminders go to that parent. Both see it. Choosing a different paying parent is not built.
- An old family-wide period that already counted a child is not detected when a per-child period is started for that child. Only matters for periods created before migration 0006 (test data).
- Messages are still sent by staff from their own WhatsApp/email; no provider is connected.
- A new login is still created in the Supabase dashboard (Add user); the role is then given in the app (Staff screen). There is no in-app invite or "forgot password" (Google sign-in covers it; email invitations need an email service connected to Supabase).
