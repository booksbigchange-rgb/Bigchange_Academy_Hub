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
