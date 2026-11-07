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

Run it yourself: create a scratch database, load the auth stubs described in the script header, apply both migrations, then `tests/sql/run_rls_tests.sh -h <host> -U postgres -d <db>`.

## Still required before real data
Test with separate real admin/teacher/finance/learner/guardian **test** accounts in the app; privacy and consent review; backups.

## Migration 0003 — parent payment periods and guardian contacts
File: `supabase/migrations/20261107_0003_fees_and_guardians.sql` (run after 0001 and 0002; safe to re-run). Tested locally on PostgreSQL 16 with `tests/sql/run_rls_tests.sh` (77/77).

- **One record per parent per 3-month period** (`academy_fee_periods`), with that parent's own start and end dates. Currency USD. The amount is computed in SQL (`academy_family_fee`): USD 150 if the family has exactly one course in total, otherwise USD 100 per course; courses are counted per child, once per course, over active children with an admin-verified link. Periods are created only through `academy_create_fee_period` (finance/admin); overlapping periods for a parent are refused.
- **Workflow:** a form teacher of any of the parent's children (or finance/admin) reports status, payment date, method and a note via `academy_report_payment`; finance checks it; only an admin approves it. Each step must match the one before; changing the report resets the check and approval. Dates cannot be in the future.
- **One record, every teacher:** teachers read the parent's record through `academy_teacher_fee_periods()` (only parents of their own students; their own students' and courses' names only). Teachers cannot read or update the table directly.
- **Overdue** = not approved as paid after the period ended (UTC).
- **Guardians:** contacts via `academy_add_guardian()` (admin or the student's teacher); one guardian per phone number and per email, so a parent with several children is one record. Teacher-added links are unverified until an admin verifies; guardians see a child only when verified.
- **Staff logins** are created in the dashboard, then `supabase/manual/provision_staff.sql` (teacher/finance) or `provision_test_admin.sql` (admin).
- The older `academy_fee_obligations` and `academy_external_payments` tables from migration 0001 stay locked and unused. Nothing here moves money or sends messages.

## Migration 0004 — guardian contact privacy
File: `supabase/migrations/20261108_0004_guardian_privacy.sql`. Teachers see a parent's name, phone and email only once an admin has verified the link; for pending links they see "Parent (waiting for verification)". Admin and finance are unaffected. Closes a gap where a teacher could type a known phone number and read that parent's details before verification. Local DB checks: 79/79.
