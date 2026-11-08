# Next steps for the owner (in order)

Files are on branch `ccr-7b420966-pk4uiw`: https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub/tree/ccr-7b420966-pk4uiw

## 0. Sign-in settings — done
Verified on 2026-11-08: email sign-in ON, public sign-up OFF.

## 1. Privacy fix (if not yet run)
SQL Editor → run `supabase/migrations/20261108_0004_guardian_privacy.sql` → expect "Success".

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
See `docs/MERGE_PLAN.md`. One pull request replaces the 18 stacked drafts.

## 7. Decisions only you can make
- Child joining mid-period: full fee (current) or reduced?
- Course levels: keep in the course name (current) or a separate field?
- Email/WhatsApp sending: which provider, if any (may cost money; needs recorded parent consent)?

## 8. Before real families
Complete `docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md`. Until then, test data only.
