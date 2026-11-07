# BigChange Academy Hub

School management web app for BigChange Academy: students, guardians (parents), courses, classes, attendance and parent payment tracking, with separate screens for administrators, teachers, finance staff, parents and students.

It is an independent React + TypeScript + Vite app backed by Supabase (Postgres + Auth). It is **not a fork** of Globussoft School MIS; no code or assets were copied from it.

> **Use test data only** until the privacy and safeguarding checklist ([docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md](docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md)) is complete. The app records payment *status*; it never takes money and never sends messages.

## Two modes

| Mode | When | What you see |
|---|---|---|
| **Demo** | No `.env` file | Fictional sample data in the browser. Role switcher for previewing; nothing is saved. Used for the public preview. |
| **Live** | `.env` with your Supabase URL and publishable key | Sign-in page. After sign-in, screens for your role, saved to the database. |

## What the live app does

| Role | Screens |
|---|---|
| Admin | Overview · Students (add, search, edit, deactivate) · Guardians (add, verify) · Courses · Classes (create, assign teacher, roster, enroll/remove) · Attendance · Fees (start periods, report, check, **approve**) |
| Teacher | Overview · their students · Guardians (add for their students) · their classes · Attendance (their classes) · Parent payments (**report** a payment) |
| Finance | Fees (start periods, report, **check**, copy reminders) · Overview · Guardians · Students |
| Parent | Their verified children's classes and attendance · their payments |
| Student | Their classes and attendance |

**Payments (school policy):** a parent pays once per 3-month period for all of their children's courses, in US dollars: **150** if the family has one course in total, otherwise **100 per course**. Each parent has their own period dates. A form teacher reports the payment (date, method, note), finance checks it, an admin approves it. Every teacher of that parent's children sees the same record. Unpaid after the period ends = **Overdue**. The amount is computed by the database.

The database enforces all of this with Row Level Security (RLS); hiding a button is never the only protection. Details: [docs/ACCESS_RULES.md](docs/ACCESS_RULES.md).

---

## Setup from scratch

### 1. Install tools (once per computer)
- **Node.js 20 or newer** (LTS) from https://nodejs.org — check with `node -v`.
- **Git** from https://git-scm.com — check with `git --version`.

### 2. Get the code
```
git clone -b ccr-7b420966-pk4uiw https://github.com/booksbigchange-rgb/Bigchange_Academy_Hub.git Academy_Hub_Live
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
5. [`supabase/checks/verify_academy_readonly.sql`](supabase/checks/verify_academy_readonly.sql) — expect 15 tables, 0 missing RLS, 0 missing force RLS, 42 policies, 0 tables without policy, 0 anon/public policies.

Each migration is safe to run again. Do **not** run `supabase/policies/academy_profile_access.sql` (superseded by 0002).

### 4. Create logins (Supabase dashboard)
For every person: **Authentication → Users → Add user**, their email, a password of 12+ characters, tick **Auto Confirm User**. Give them the password yourself. Then attach a role with one of these scripts. **Copy the script into a private SQL Editor tab and change only the `target_...` lines; leave the placeholder text in the `IF` checks alone; never edit or commit these files on GitHub with real emails.**

| Who | Script |
|---|---|
| Administrator | [`supabase/manual/provision_test_admin.sql`](supabase/manual/provision_test_admin.sql) |
| Teacher or finance | [`supabase/manual/provision_staff.sql`](supabase/manual/provision_staff.sql) |
| Parent or student (after they exist in the app) | [`supabase/manual/link_login.sql`](supabase/manual/link_login.sql) |

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
2. **Students** → add a student.
3. **Classes** → create a class, pick the teacher, **View** → enroll the student.
4. **Guardians** → choose the student → add the parent (phone `09XXXXXXXX` or `+251…`, email). Teacher-added parents must be **Verified** by an admin.
5. **Fees** → choose the parent → **Show fee** → **Start period**.
6. Teacher reports the payment → finance **Check** → admin **Approve**.
7. **Attendance** → choose class → add lesson → mark → **Save**.

---

## Development

```
npm run typecheck   # TypeScript
npm test            # unit tests (node --test)
npm run build       # production build
```
The live screens have a browser smoke test against a fake in-memory Supabase (admin, teacher and finance flows, phone-width layout): see the header of [`tests/e2e/live-smoke.mjs`](tests/e2e/live-smoke.mjs). Database access rules have their own test against a throwaway PostgreSQL (needs PostgreSQL 16 locally; never point it at the real project): see the header of [`tests/sql/run_rls_tests.sh`](tests/sql/run_rls_tests.sh).

| Path | What |
|---|---|
| `src/live/` | Live (database) app: `LiveApp.tsx` shell, `api.ts` all database calls, `validation.mjs` / `fees.mjs` pure rules |
| `src/SecureApp.tsx` | Sign-in and role check |
| `src/App.tsx`, `src/components/` | Demo app (fictional data) |
| `supabase/migrations/` | Database schema and rules, applied in order |
| `supabase/manual/` | One-off admin scripts (copy to a private tab) |
| `docs/` | Access rules, progress log, privacy checklist, milestone notes |

GitHub Actions (`.github/workflows/`) type-checks, tests and builds on every push.

## Known limits
- No automatic email/WhatsApp: needs a provider and recorded parent consent. Fees has a **Copy reminder** button instead.
- Staff, parent and student logins are created in the Supabase dashboard (above), not inside the app; doing that in-app needs a small server with a secret key.
- The free Supabase plan pauses inactive projects; restore from the dashboard.
- Manual testing on Chromebooks, phones and screen readers has not been done yet.

Progress and open items: [docs/PROGRESS.md](docs/PROGRESS.md).
