# Next steps for the owner (in order)

Updated 2026-11-17 (Staff screen added). The code for the internal staff version is finished and tested. What is left can only be done by the owner, in the Supabase and hosting dashboards. Files are on branch `main`: https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub

## To do

### 0. Run migration 0010 (about 2 minutes)
Supabase → SQL Editor → paste `supabase/migrations/20261117_0010_staff_roles_in_app.sql` → **Run** → "Success". Then run `supabase/checks/verify_academy_readonly.sql`: still **17 tables, 46 policies**. It adds the admin's **Staff** screen. Safe to run twice. Until it is run, the Staff screen says it could not load; everything else works.

### 1. Put it online (about 15 minutes, free)
Follow `docs/HOSTING.md` (Netlify, deploying from `main`), then set the new address in Supabase **Authentication → URL Configuration**. After this, staff can use the app from their own phones and computers.

### 2. Google sign-in for staff (about 20 minutes, free, recommended)
Follow `docs/GOOGLE_SIGNIN.md`. Staff then need no password, and nobody needs a password reset. Do this after step 1 so the hosted address can be entered.

### 3. Add the staff
For each person: Supabase → **Authentication → Users → Add user** (their email, tick **Auto Confirm User**), then give the role in the app: **Staff** → **Refresh list** → **Give a role** (teacher, finance or admin). This needs migration 0010 (step 0 below). Use **Add user**, not **Invite user**: Supabase's built-in email does not deliver invitations to people outside your Supabase organization (see `docs/HOSTING.md`).
As admin in the app: **Classes** → set each class's **Teacher**.

### 4. Check the roles on the real project (your computer, test accounts)
In `D:\Codex\Academy_Hub_Live`: `git pull`, then
```
set ADMIN_EMAIL=...&& set ADMIN_PASSWORD=...
set TEACHER_EMAIL=...&& set TEACHER_PASSWORD=...
node tests/live-project-check.mjs
```
Every line should say PASS. Send any FAIL lines. Close the window afterwards.

### 5. One run-through with fake names
Admin: course → student **with parent** → class with teacher → enroll → Fees: start the child's 3 months.
Teacher (private window, and once on a phone): Fees → Report payment; Attendance → mark a lesson; Notices → write a notice.
Finance: Check → Download payments (CSV). Admin: Approve → everyone sees **Paid**.

### 6. Weekly backup and a second admin
Follow `docs/BACKUPS.md`. Choose who makes the weekly copy.

### 7. Before real families' data goes in
Complete `docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`. Until then, test data only. This is the owner's decision with legal advice; the app shows a reminder on every screen until then.

## Done
- Sign-in settings: email sign-in ON, public sign-up OFF (verified 2026-11-08).
- Migrations 0001–0009 run on the real project (0008 on 2026-11-10; 0009 confirmed present on 2026-11-17 by a signed-out check: the payment-methods table and the new payment-report function exist and refuse anonymous access).
- Everything merged into `main` (pull requests #19–#25); CI green.
- The five owner decisions answered and built (`docs/DECISIONS.md`).
