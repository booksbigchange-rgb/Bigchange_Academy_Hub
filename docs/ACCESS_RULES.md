# Access rules (migration 0002)

File: `supabase/migrations/20261031_0002_access_rules.sql`. Apply only in the **new dedicated Academy project**, after `20261015_0001_locked_schema.sql`. It supersedes `supabase/policies/academy_profile_access.sql` (do not run both).

| Role | Can do |
|---|---|
| admin | Everything except deleting records; manages people, classes, enrollments, guardians, courses; verifies payments; reads the audit trail |
| teacher | Sees only own classes, their learners, sessions, attendance, assignments; records attendance and manages lessons/assignments for own classes; no fees, guardians or payments |
| finance | Sees all learners, guardians and fees; creates/edits fee obligations; records external payments (cannot self-verify) |
| learner | Sees only own profile, classes, attendance, submissions; submits own work |
| guardian | Sees only verified-linked children's classes, attendance, submissions, fees and payments |

Safeguards: RLS forced on all 14 tables; no anon access; no client DELETE on people, fees, payments or audit; unique attendance per session+learner; attendance only for enrolled learners and attributed to the recording staff member; unique fee per learner+month; append-only audit trigger on fees, payments, attendance, enrollments and guardian links; `academy_fee_status` view derives Paid/Overdue/Partial/Unpaid.

## Prerequisite
`select rolbypassrls from pg_roles where rolname = 'postgres';` must return `true` (it does on Supabase) or the helper functions and audit trigger cannot work.

## Verified locally (not on Supabase)
Applied 0001 then 0002 to a throwaway PostgreSQL 16 with stubbed `auth` schema and roles; re-ran 0002 (idempotent); `tests/sql/run_rls_tests.sh` passed 37/37 role-isolation checks. Not yet run against the real Supabase project, and `auth.uid()` there is the real JWT-based function.

Run it yourself with one command: `tests/sql/run_local.sh` (needs PostgreSQL 16 installed). It starts a throwaway database, loads the Supabase stand-ins (`tests/sql/auth_stubs.sql`), applies every migration, runs the checks and deletes the database. CI runs the same command.

## Still required before real data
Test with separate real admin/teacher/finance/learner/guardian **test** accounts in the app; privacy and consent review; backups.

## Migration 0003 — parent payment periods and guardian contacts
File: `supabase/migrations/20261107_0003_fees_and_guardians.sql` (run after 0001 and 0002; safe to re-run). Tested locally on PostgreSQL 16 with `tests/sql/run_rls_tests.sh` (77/77).

- **One record per parent per 3-month period** (`academy_fee_periods`), with that parent's own start and end dates. Currency USD. The amount is computed in SQL (`academy_family_fee`): USD 150 if the family has exactly one course in total, otherwise USD 100 per course; courses are counted per child, once per course, over active children with an admin-verified link. Periods are created only through `academy_create_fee_period` (finance/admin); overlapping periods for a parent are refused.
- **Workflow:** a form teacher of any of the parent's children (or finance/admin) reports status, payment date, method and a note via `academy_report_payment`; finance checks it; only an admin approves it. Each step must match the one before; changing the report resets the check and approval. Dates cannot be in the future.
- **One record, every teacher:** teachers read the parent's record through `academy_teacher_fee_periods()` (only parents of their own students; their own students' and courses' names only). Teachers cannot read or update the table directly.
- **Overdue** = not approved as paid after the period ended (UTC).
- **Guardians:** contacts via `academy_add_guardian()` (admin or the student's teacher); one guardian per phone number and per email, so a parent with several children is one record. Teacher-added links are unverified until an admin verifies; guardians see a child only when verified.
- **Staff logins** are created in the dashboard; the first admin gets the role with `provision_test_admin.sql`, everyone else on the **Staff** screen (migration 0010).
- The older `academy_fee_obligations` and `academy_external_payments` tables from migration 0001 stay locked and unused. Nothing here moves money or sends messages.

## Migration 0004 — guardian contact privacy
File: `supabase/migrations/20261108_0004_guardian_privacy.sql`. Teachers see a parent's name, phone and email only once an admin has verified the link; for pending links they see "Parent (waiting for verification)". Admin and finance are unaffected. Closes a gap where a teacher could type a known phone number and read that parent's details before verification. Local DB checks: 79/79.

## Migration 0010 — staff roles in the app
File: `supabase/migrations/20261117_0010_staff_roles_in_app.sql`. No new tables or policies (17 tables, 46 policies).
- `academy_staff.active`: staff rows are never deleted; an admin switches access off. `academy_staff_id()` and `academy_staff_role()` return nothing for a switched-off person, so every rule that depends on them refuses, and they cannot see their own staff row (the app shows "no role assigned").
- `academy_staff_directory()` (admin only): confirmed logins that are not students or parents, with email, role, access, class count and last sign-in.
- `academy_set_staff_role(user, role, name)` (admin only): gives or changes teacher / finance / admin and switches access on. Refused for: your own account (no self-lockout), unconfirmed or unknown logins, student or parent logins, and a teacher who still has classes being moved to another role.
- `academy_set_staff_active(staff, on/off)` (admin only, never yourself).
- Roles and access still cannot be changed by editing the table (only `display_name` and `specialty` are writable). Every change to a staff row is audited.

## Migration 0011 — staff chat
File: `supabase/migrations/20261121_0011_staff_chat.sql`. Adds 6 tables and 6 policies (23 tables, 52 policies). Plan: `docs/M6_PHONE_AND_STAFF_CHAT_PLAN.md`.
- **Who:** active staff only. Parents, students and switched-off staff have no access (every rule goes through `academy_staff_id()`).
- **Conversations:** one-to-one (`academy_chat_start_direct`, one per pair) and groups made by the database: All staff, Teachers (teachers + admins), Finance (finance + admins), and one per class (its current teacher + admins; created automatically for new classes). Group membership is worked out live from roles, class teachers and access, so a new class teacher joins and the old one leaves at once.
- **Reading:** `academy_chat_is_member()` decides; Realtime uses the same rule. Admins are in every group but **not** in other people's one-to-one chats.
- **Writing:** only through functions — `academy_chat_send` (text up to 4,000 characters and/or an `https://` link), `academy_chat_mark_read`, `academy_chat_delete_message` (own message, within 15 minutes, not once reported; the text is removed), `academy_chat_report` (reason 3–500 characters, once per person per message).
- **Reports (admin):** `academy_chat_report_list`, `academy_chat_open_report` (the only way to read a chat the admin is not in; every opening is written to `academy_chat_admin_access`), `academy_chat_handle_report`.
- **Audit:** reports are audited; message text is never copied to the audit trail.
- Not yet: phone alerts (step 5), removal after one school year (step 7).
- Local DB checks: 244/244 (61 for chat).

## Migration 0012 — chat photos and files
File: `supabase/migrations/20261122_0012_chat_files.sql`. Adds 1 table and 1 policy (24 tables, 53 policies), a **private** storage bucket `chat-files` (10 MB limit, allowed types only) and storage rules.
- **Allowed:** PDF, Word, Excel, PowerPoint, CSV, plain text, JPEG/PNG/WebP/HEIC photos, up to 10 MB. Refused by the bucket and again by the database.
- **Where:** `chat-files/<conversation>/<random id>/<name>`. Only members of a conversation can upload into its folder. Staff can never overwrite or delete stored files.
- **Sending:** `academy_chat_send_file()` checks that the file is in that conversation's folder and was uploaded by the sender, reads the real size and type from storage, and attaches it once.
- **Opening:** members only, while the message is not deleted; an admin only after opening a report on that conversation (each opening is recorded). The app uses one-hour signed links; the bucket is never public.
- **Deleting a message** (own, within 15 minutes, not reported) removes its attachment records, so the file can no longer be opened. Uploaded-but-unsent files and the stored copies of deleted files are removed by the clean-up job (step 7).
- Photos are made smaller on the phone (long side 1600 px, JPEG) before upload; HEIC photos are sent as they are.
- Local DB checks: 279/279 (35 for files).
