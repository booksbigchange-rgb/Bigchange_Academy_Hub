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

## Remaining (needs owner input or credentials)
1. Persistence and real auth: Supabase project key, migrations, RLS tests.
2. Email/WhatsApp provider, parent contact and consent records.
3. Payment-status audit trail server-side (current history is in-memory).
4. (Done) Teacher and student detail view with editable grade/specialty and note; see `src/components/AcademyPersonProfile.tsx`.
5. Manual Chromebook/mobile/screen-reader testing.
6. Merge strategy for the 18 stacked draft PRs.

7. Live slices still to build: attendance, fees/payments/reminders, learner and guardian views, teacher login creation (needs a server-side invite).
