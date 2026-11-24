# BigChange Academy Hub

Internal school management web app for BigChange Academy staff (admin, teachers, finance) first: students, guardians (parents), courses, classes, attendance and parent payment tracking, with separate screens for administrators, teachers, finance staff, parents and students.

It is an independent React + TypeScript + Vite app backed by Supabase (Postgres + Auth). It is **not a fork** of Globussoft School MIS; no code or assets were copied from it.

> **Use test data only** until the privacy and safeguarding checklist ([docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md](docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md)) is complete. The app records payment *status*; it never takes money and never sends messages by itself (staff send from their own WhatsApp or email).

## Two modes

| Mode | When | What you see |
|---|---|---|
| **Demo** | No `.env` file | Fictional sample data in the browser. Role switcher for previewing; nothing is saved. Used for the public preview. |
| **Live** | `.env` with your Supabase URL and publishable key | Sign-in page. After sign-in, screens for your role, saved to the database. |

## What the live app does

| Role | Screens |
|---|---|
| Admin | Reports (**lessons per teacher per month**, **monthly report** to print or save as PDF, **activity log**: who changed what and when; CSV downloads) · Staff (give roles, switch access off/on, **profile** of each teacher: classes, lessons per month, attendance not completed) · Overview (colour cards, payments donut, students per course, attendance line and heat calendar) · Students (add, **import from a spreadsheet**, search, edit, deactivate, attendance history, **profile**: parents, classes, payments, attendance calendar) · Guardians (parent directory, add, verify) · Courses (add, edit) · Classes (create, rename, assign teacher, roster, enroll/remove) · Attendance · Fees (start periods, report, check, **approve**) |
| Teacher | Overview · their students and their attendance history · Guardians (add for their students) · their classes · Attendance (their classes) · Parent payments (**report** a payment) |
| Finance | Fees (**needs the next 3 months** list, start periods, report, **check**, reminders, **download payments as CSV** for Google Sheets) · Overview · Guardians · Students |
| Parent | Their verified children's classes and attendance · their payments |
| Student | Their classes and attendance |

**Reminders:** once a family's 3 months have ended unpaid, teachers (for their own students' parents) and finance get a **Send on WhatsApp** button that opens WhatsApp with the reminder written; staff press send. Only parents who agreed to WhatsApp get the button; the date of every reminder is recorded. Finance also gets a list of everyone to remind, can copy the numbers for a WhatsApp broadcast list, and can email everyone who agreed to email in one go (opens their own email app with parents in BCC; free).

**Next 3 months:** Fees lists every enrolled child whose 3 months have ended or end within 14 days, and every enrolled child who never had a period, with **Start next 3 months** (starts on the day the last ones ended, so no days are lost).

**Downloads (CSV, for Google Sheets or Excel):** payments (Fees, finance/admin) and attendance (Attendance: one class or all, optional dates; teachers get their own classes).

**Level dates:** each class stores its current level's start and end (3 months by default; change it for 6-month computer stages). The Overview lists **levels ending soon** (within 14 days, or in the break week) with a **Write notice to parents** button, and **Move to next level** renames the class ("English – Level 2" → "Level 3", "Canva" → "Wix") with new dates after the one-week break; the same students stay enrolled.

**Notices:** teachers pick a class and the last day of the level (filled in automatically when the class has level dates); the app writes "finishes on…, one-week break, next level starts on…" and opens WhatsApp to choose the class group. The app never sends messages by itself.

**Payments (school policy):** every 3 months per child, counted from the day that child starts, in US dollars: **150** if the family has one course in total, otherwise **100 per course**. A brother or sister who joins later gets their own dates; the admin can change any amount, with a reason. A form teacher reports the payment (date, method, note), finance checks it, an admin approves it. Every teacher of that parent's children sees the same record. A family becomes **Overdue** 14 days after their 3 months end without an approved payment. The amount is computed by the database.

The database enforces all of this with Row Level Security (RLS); hiding a button is never the only protection. Details: [docs/ACCESS_RULES.md](docs/ACCESS_RULES.md).

---

## Setup from scratch

### 1. Install tools (once per computer)
- **Node.js 20 or newer** (LTS) from https://nodejs.org — check with `node -v`.
- **Git** from https://git-scm.com — check with `git --version`.

### 2. Get the code
```
git clone https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub.git Academy_Hub_Live
cd Academy_Hub_Live
npm ci
```
To update later: `git pull` inside the folder.

### 3. Create the database (Supabase dashboard, once)
Use a **dedicated** Supabase project for the Academy. In the project: **SQL Editor → New query**, paste each file's full contents, **Run**, one at a time, in this order:

1. Check: `select rolbypassrls from pg_roles where rolname = 'postgres';` → must be `true`.
2. [`supabase/migrations/20261015_0001_locked_schema.sql`](supabase/migrations/20261015_0001_locked_schema.sql) — tables, everything locked.
3. [`supabase/migrations/20261031_0002_access_rules.sql`](supabase/migrations/20261031_0002_access_rules.sql) — who may see and do what.
4. [`supabase/migrations/20261107_0003_fees_and_guardians.sql`](supabase/migrations/20261107_0003_fees_and_guardians.sql) — parent payment periods and guardian contacts.
5. [`supabase/migrations/20261108_0004_guardian_privacy.sql`](supabase/migrations/20261108_0004_guardian_privacy.sql) — teachers cannot see a parent's contact details until an admin verifies the link.
6. [`supabase/migrations/20261109_0005_reminders_and_grace.sql`](supabase/migrations/20261109_0005_reminders_and_grace.sql) — 14 days' grace before Overdue, WhatsApp reminders with recorded dates, permission changes.
7. [`supabase/migrations/20261110_0006_child_periods_and_amounts.sql`](supabase/migrations/20261110_0006_child_periods_and_amounts.sql) — each child's own 3 months, admin can change an amount (with a reason), email reminders.
8. [`supabase/migrations/20261111_0007_class_level_dates.sql`](supabase/migrations/20261111_0007_class_level_dates.sql) — each class's level start and end dates, reminders before a level ends, move a class to its next level.
9. [`supabase/migrations/20261112_0008_local_dates_and_parents.sql`](supabase/migrations/20261112_0008_local_dates_and_parents.sql) — dates follow Israel time (where the admin works), family-wide periods retired, both verified parents see their child's payments.
10. [`supabase/migrations/20261113_0009_payment_methods_and_amounts.sql`](supabase/migrations/20261113_0009_payment_methods_and_amounts.sql) — the school's own payment methods (the admin can add, rename or switch them off) and an optional amount on each payment report.
11. [`supabase/migrations/20261117_0010_staff_roles_in_app.sql`](supabase/migrations/20261117_0010_staff_roles_in_app.sql) — the admin gives staff their role and switches access off or on in the app (**Staff** screen), instead of SQL scripts.
12. [`supabase/checks/verify_academy_readonly.sql`](supabase/checks/verify_academy_readonly.sql) — expect 17 tables, 0 missing RLS, 0 missing force RLS, 46 policies, 0 tables without policy, 0 anon/public policies.

Each migration is safe to run again. Do **not** run `supabase/policies/academy_profile_access.sql` (superseded by 0002).

### 4. Create logins (Supabase dashboard)
For every person: **Authentication → Users → Add user**, their email, tick **Auto Confirm User** (a password of 12+ characters if they will not use Google; give it to them yourself).

- **The very first admin:** attach the role once with [`supabase/manual/provision_test_admin.sql`](supabase/manual/provision_test_admin.sql).
- **Everyone else on staff (teachers, finance, more admins):** the admin opens **Staff** in the app → **Refresh list** → the new login is under **Waiting for a role** → **Give a role**. The same screen changes a role or switches someone's access off (and on again). No SQL needed.
- **Parent or student** (after they exist in the app): [`supabase/manual/link_login.sql`](supabase/manual/link_login.sql).

**For the scripts: copy them into a private SQL Editor tab and change only the `target_...` lines; leave the placeholder text in the `IF` checks alone; never edit or commit these files on GitHub with real emails.** (`supabase/manual/provision_staff.sql` still works if the app is unavailable.)

Forgot a password? In SQL Editor (then delete the query, it contains the password):
```sql
update auth.users set encrypted_password = extensions.crypt('NEW-PASSWORD-12+', extensions.gen_salt('bf'))
where lower(email) = lower('person@example.com');
```

### 5. Connect the app
In the project folder create a file named `.env` (not `.env.txt`), e.g. `notepad .env`:
```
VITE_ACADEMY_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
Both values are in Supabase under **Project Settings → API Keys**. Only the **publishable** key belongs here; the app refuses secret/service-role keys. `.env` is git-ignored, never commit it.

### 6. Run
```
npm run dev
```
Open http://127.0.0.1:5173 and sign in. Stop with Ctrl+C. After changing `.env`, restart.

### 7. First-day checklist (as admin, fake names)
1. **Courses** → add a course (put levels in the name, e.g. "English Level 2").
2. **Students** → add a student together with the parent's name, phone and/or email (a parent already on file by phone or email is reused for siblings). Many students at once: **Import from a spreadsheet (CSV)** (Google Sheets: File → Download → CSV); a template can be downloaded there. Create the classes first if the sheet has a Class column.
3. **Classes** → create a class, pick the teacher, **View** → enroll the student.
4. **Guardians** → check the parent is there; add a second parent here if needed. Teacher-added parents must be **Verified** by an admin.
5. **Fees** → choose the parent → **Show fee** → **Start period**.
6. Teacher reports the payment → finance **Check** → admin **Approve**.
7. **Attendance** → choose class → add lesson → mark → **Save**.

---

### 8. Check the roles on your real project (optional, test accounts only)
In the project folder, set the test logins for this window only, then run the check. It reads, and tries a few things that must be refused; it changes nothing.
```
set ADMIN_EMAIL=you@example.com&& set ADMIN_PASSWORD=...
set TEACHER_EMAIL=teacher@example.com&& set TEACHER_PASSWORD=...
node tests/live-project-check.mjs
```
Close the window afterwards. Also in Supabase: **Authentication → Sign In / Providers → turn off "Allow new users to sign up"** (staff add users themselves).

## Development

```
npm run typecheck   # TypeScript
npm test            # unit tests (node --test)
npm run build       # production build
npm run test:e2e    # browser test of every role against a fake database, with accessibility scan
                    # (first time: npx playwright install chromium)
bash tests/sql/run_local.sh   # database access rules on a throwaway PostgreSQL 16 (never the real project)
```
The browser test ([`tests/e2e/live-smoke.mjs`](tests/e2e/live-smoke.mjs)) drives every role's screens against a fake in-memory Supabase, at desktop and phone width, with an axe accessibility scan of every screen. The database test applies every migration to a throwaway PostgreSQL and checks who may see and do what ([`tests/sql/run_rls_tests.sh`](tests/sql/run_rls_tests.sh)).

| Path | What |
|---|---|
| `src/live/` | Live (database) app: `LiveApp.tsx` shell, `api.ts` all database calls, `validation.mjs` / `fees.mjs` pure rules |
| `src/SecureApp.tsx` | Sign-in and role check |
| `src/App.tsx`, `src/components/` | Demo app (fictional data) |
| `supabase/migrations/` | Database schema and rules, applied in order |
| `supabase/manual/` | One-off admin scripts (copy to a private tab) |
| `docs/` | Access rules, progress log, privacy checklist, milestone notes |

GitHub Actions (`.github/workflows/ci.yml`) runs all of the above on every push and pull request.

## Google sign-in
Staff can sign in with their Google account (free; one-time setup in Google Cloud and Supabase): see [docs/GOOGLE_SIGNIN.md](docs/GOOGLE_SIGNIN.md). Only people the admin added can get in.

## Putting it online
So teachers can use it from their own devices and invitations work, host it (free plans exist on Netlify and Cloudflare Pages): see [docs/HOSTING.md](docs/HOSTING.md). Security headers ship in `public/_headers`.

## Known limits
- No automatic email/WhatsApp: the app writes the message and opens WhatsApp or the email app; a staff member presses send.
- Staff, parent and student logins are created in the Supabase dashboard (above), not inside the app. There is no "forgot password" link: staff use Google sign-in, or the admin resets the password (step 4).
- The free Supabase plan pauses inactive projects; restore from the dashboard.
- Manual testing on Chromebooks, phones and screen readers has not been done yet.

Weekly backup and a second admin: [docs/BACKUPS.md](docs/BACKUPS.md). Progress and open items: [docs/PROGRESS.md](docs/PROGRESS.md). Owner to-do list: [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md). Latest audit: [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md). Open questions for the owner: [docs/DECISIONS.md](docs/DECISIONS.md).
