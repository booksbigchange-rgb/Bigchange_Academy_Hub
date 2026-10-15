# Secure Foundation Milestone — 2026-10-15

## Implemented in code
- Optional invitation-only sign-in gate using a pinned Supabase JS SDK version and email/password sign-in.
- Authenticated identity checked through `supabase.auth.getUser()`, followed by a database lookup constrained to the caller's user ID **and** RLS ownership policy.
- Staff identities: admin, teacher or finance; learner and guardian self-identities supported; no public sign-up or editable client role selector when the secure gate is configured.
- Unknown or unapproved accounts cannot access any private features.
- Authentication cannot fall back to the fictional demo after a partial/invalid configuration. Non-publishable keys rejected.
- All personal, attendance, course, finance and notification operations remain disabled behind the Auth gate. Existing demo is static and fictional.
- Sample database remains deny-by-default; a **separate** review-only policy draft permits authenticated users to read *only* their own profile (staff/learner/guardian). No client writes or other reads allowed.
- Tests for configuration, query constraints and SQL grant policy shape. These tests are not a substitute for actual RLS integration tests.

## Deployment and database state
- This feature has not been configured with any live Supabase credentials. It has not been tested against a Supabase Auth server or PostgreSQL. No data migrated.
- Existing Supabase project belongs to an unidentified app. Do not modify it for the Academy.
- The user supplied a distinct Supabase project URL: https://nwpaqjzwqwkqxibwvusr.supabase.co (different account). This is an intended target only; the connected Supabase tool does not see the project, so no schema or authentication configuration has been applied to it. A publishable key and authorized project connection are still needed. The existing connected Supabase account remains untouched.
- The demo Pages build has **no** `VITE_ACADEMY_*` settings, so it continues to show only fictional records.

## Remaining release gates (not complete)
- Set up a distinct approved, cost-checked Supabase project and apply schema and policies via reviewed migrations.
- Validate staff/learner/guardian identity provisioning using admin-only infrastructure; no service role key in browser.
- Run RLS end-to-end tests with separate authenticated principals, including cross-student/cross-guardian denial, invoice/attendance denial, and request forgery tests.
- Test sign-in, disabled accounts, logout, session expiry, password reset, error feedback and protection from brute force.
- Complete minors' privacy legal review, verified guardian permissions, security, backups and retention controls.
- Only after controls are approved, connect read/write flows for real student accounts.

## Notes on policy trust
User-editable metadata and the React role dropdown must never decide database authorization. Policy logic is based on `auth.uid()` plus server-managed Academy identity rows. Profiles cannot be inserted, updated or deleted by browser clients.

## Next handoff
Specify which Supabase organization should own a new Academy-only project. The project cost must be checked and approved before project creation. `main` is deliberately unchanged.
