# BigChange Academy — Supabase Setup WITHOUT a ChatGPT Connector
Date: 2026-10-15

**Target project only**: `https://nwpaqjzwqwkqxibwvusr.supabase.co`
Dashboard: https://supabase.com/dashboard/project/nwpaqjzwqwkqxibwvusr

This walkthrough does not require connecting Supabase to ChatGPT, installing Docker, or sending any secrets to a chatbot. Use the Supabase **dashboard in the separate Academy account**. The connected Supabase plugin may still point to a different account: do not use that project.

## Important safety status
The SQL files below are **design-stage drafts** and are not independently tested on the new project. Only apply them to a confirmed new/empty Academy database after reviewing the SQL. They create tables and restrictive own-profile permissions but **do not make a production school system**. No real minor, guardian, attendance, payment, or contact data yet. Public Pages demo remains fictional and disconnected.

## Phase A — preflight (no changes)
1. Sign in to the *new* Supabase account and open the Academy project from the link above. Check project reference: `nwpaqjzwqwkqxibwvusr`.
2. In the left sidebar select **SQL Editor → New query**.
3. Run this read-only preflight query:
   ```sql
   select count(*) as existing_academy_tables
   from pg_tables
   where schemaname='public' and tablename like 'academy_%';
   ```
4. Expected on a brand-new dedicated project: **0**. If not 0, STOP, save a screenshot of table names only (no student information) and ask for a review before proceeding.

## Phase B — create locked tables
1. Open the [locked schema draft](../supabase/migrations/20261015_0001_locked_schema.sql).
2. Select **Raw** and copy its entire SQL text.
3. Return to SQL Editor → New query, paste and review it. Confirm the project is the new Academy one and click **Run**.
4. This creates 14 Academy-prefixed tables and enables **FORCE Row Level Security**. It does not create users or grant client access.

## Phase C — grant only own-profile reads
1. Open the [own-profile policy draft](../supabase/policies/academy_profile_access.sql).
2. Select **Raw**, copy, review and run it in a new SQL Editor query.
3. The script revokes default anonymous/authenticated grants for all 14 tables, then grants authenticated accounts SELECT on three identity tables **only for their own rows**. All other student, finance and class records remain denied.
4. **Run exactly once** after the schema; don't rerun CREATE POLICY statements without reviewing existing policies.

## Phase D — read-only verification
1. Open [Academy SQL verification](../supabase/checks/verify_academy_readonly.sql). Select **Raw** and copy its contents.
2. Run it in SQL Editor.
3. The result should be:
   - `academy_table_count = 14`
   - `missing_rls = 0`
   - `missing_force_rls = 0`
   - `policy_count = 3`
   - `unexpected_policy_count = 0`
4. If any number differs, STOP; do not invite users or connect the app yet. Share only the result counts or an image showing **no private data**.

**This query verifies settings but does not prove security.** We must still do real isolated authenticated user tests, check that cross-student and cross-guardian reads are rejected, and test revocation.

## Phase E — find the public publishable key (do not share secrets)
1. Open your new project and select **Project Settings → API Keys** (or the project **Connect** dialog).
2. Find the **Publishable key**, beginning `sb_publishable_`.
3. The project URL and publishable key may be used in the browser **only after RLS has been tested**. The secret/service-role/database password must NEVER be pasted in chat or committed to GitHub.
4. The app is already prepared to read these specific frontend environment variables:
   - `VITE_ACADEMY_SUPABASE_URL=https://nwpaqjzwqwkqxibwvusr.supabase.co`
   - `VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
   Keep them out of the public demo build until verification and a separate Auth-preview deployment are ready.

## Phase F — real authentication tests (NOT YET)
- Create test adults with **Supabase Dashboard → Authentication → Users → Add user → Send invitation** (or the supported Dashboard option). Avoid real children for now.
- Associate an approved test identity with the corresponding `academy_staff`/other record **only through trusted administrator tools**, never from a role dropdown, user-editable metadata or public signup.
- Test sign-in/out, invalid users, expired sessions, and identity isolation.
- Do not enable assignments/attendance/fee writes, guardian messages, or share a real-student login until security, policy, backups and legal review have passed.

## What ChatGPT can continue to do without the connector
- Build and test original React/TypeScript code on the GitHub feature branch.
- Review read-only SQL verification results you choose to share.
- Prepare secure server-side workflows and isolated authorization test plans.
- Inspect GitHub Actions/PRs and run CI; keep the existing preview untouched.

## Troubleshooting
- SQL error `relation already exists`: stop and inspect table existence; do not drop tables or blindly rerun scripts.
- RLS returns no rows: often an intentionally blocked/unenrolled account; do not disable RLS to make it work.
- `Invalid login credentials`: ensure the invite/confirmation flow completed.
- Projects linked to different accounts cannot automatically be accessed through the existing ChatGPT Supabase connector.
- Ask for a screenshot of **settings/navigation or read-only query counts**, not any secret credentials or personal records.

Useful official guidance: 
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/users

