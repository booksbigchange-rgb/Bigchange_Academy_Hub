# Next steps for the owner (in order)

Files are on branch `ccr-7b420966-pk4uiw`: https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub/tree/ccr-7b420966-pk4uiw

## 0. Sign-in settings — done
Verified on 2026-11-08: email sign-in ON, public sign-up OFF.

## 1. Privacy fix — done
Owner ran migration 0004 on 2026-11-08 (confirmed when a teacher sees "Parent (waiting for verification)" for a pending parent).

## 1b. Migrations 0005, 0006 and 0007 (your decisions) — done (confirmed live 2026-11-11)
SQL Editor → run, in order, `supabase/migrations/20261109_0005_reminders_and_grace.sql`, `supabase/migrations/20261110_0006_child_periods_and_amounts.sql`, `supabase/migrations/20261111_0007_class_level_dates.sql` → each "Success". Then the verify script should show 16 tables and 43 policies.

## 1c. Migration 0008 (review fixes) — to do
SQL Editor → run `supabase/migrations/20261112_0008_local_dates_and_parents.sql` → "Success". It makes "today" the date in Ethiopia (no more refused payments just after midnight), retires family-wide periods (every new period belongs to one child), and lets both verified parents of a child see that child's payments. The verify script still shows 16 tables and 43 policies.

## 2. Teacher test account
1. SQL Editor: `select email, email_confirmed_at from auth.users order by created_at desc;` — find the teacher's exact email.
2. If missing: Authentication → Users → Add user → Create new user, tick **Auto Confirm User**.
3. Run the one-step teacher script (sets password, confirms, gives the teacher role) with that exact email; delete the query afterwards (it contains the password).
4. As admin: **Classes** → set the class **Teacher**; make sure a student is enrolled.

## 3. Role check on the real project (your computer)
In `D:\Codex\Academy_Hub_Live`: `git pull`, then
```
set ADMIN_EMAIL=...&& set ADMIN_PASSWORD=...
set TEACHER_EMAIL=...&& set TEACHER_PASSWORD=...
node tests/live-project-check.mjs
```
Send any FAIL lines. Close the window afterwards.

## 4. Manual run-through (fake names)
Admin: course → student **with parent** → class with teacher → enroll → Fees: start period.
Teacher (private window): Fees → Report payment; Attendance → mark a lesson.
Finance: Check. Admin: Approve → everyone sees **Paid**.

## 5. Put it online (optional, needs a free hosting account)
Follow `docs/HOSTING.md` (Netlify or Cloudflare Pages), then set Supabase **URL Configuration** to the new address. Invitations then work.

## 6. Merge into main
Pull request #19 is open: https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub/pull/19. Merge it with a merge commit, then close drafts #1–#18 (see `docs/MERGE_PLAN.md`).

## 7. Decisions
All five answered and built (see `docs/DECISIONS.md`).

## 7b. Weekly backup and second admin
Follow `docs/BACKUPS.md`.

## 8. Before real families
Complete `docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`. Until then, test data only.
