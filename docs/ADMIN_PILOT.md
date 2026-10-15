# Administrator Pilot Milestone — test accounts only

## Preflight (done by owner)
The owner verified **14 Academy tables, 0 missing RLS, 0 missing FORCE RLS and 3 profile policies** in the separate-account Academy project.
This verifies *configuration counts*, not cross-user isolation.

## Current build
- `pilot.html` is a separate optional sign-in page, built alongside the fictional demo.
- The pilot asks for the Academy project's **publishable** (public) key in the browser. Do not send it to ChatGPT. It is retained in browser local storage to support a fresh tab opening an invitation link; remove it through browser site-data controls when finishing tests.
- The pilot is restricted to self-profile verification and testing; it contains **no** functionality for student enrollment, messaging, attendance or finance.
- `SecureApp` now handles an email invitation session and offers a password-setup UI (12+ characters) using `auth.updateUser`. It does not self-register or assign staff privileges.
- The separate login page is **not a security boundary**; all user access is ultimately enforced by Supabase Auth and Postgres RLS.
- The admin SQL template uses an exact, confirmed adult test user email, prevents granting admin to an existing learner/guardian, and refuses to reassign an existing staff role. It displays no user email on success.
- Do not enter any real student or guardian data until authenticated multi-user read isolation tests and child-data legal/privacy release gates pass.

## Manual adult-only pilot steps
1. Under the NEW Supabase project `nwpaqjzwqwkqxibwvusr`, open Authentication > Users. If an old invitation is still unconfirmed, don't assume it created a password. The built-in email service is rate limited; avoid repeated invitations.
2. Use **Add user > Create new user** for a separate adult email *you control*, with a strong password; only use email auto-confirm for your own controlled test email. Do not share the email/password with ChatGPT.
3. In SQL Editor, open `supabase/manual/provision_test_admin.sql`, copy it into a *new private query*, replace the placeholder email with this precise confirmed adult test email, review the SQL, and run. Do not share the filled query.
4. Run `supabase/checks/check_test_profiles_readonly.sql` to confirm exactly the expected number of test admin identities (the exact count may vary with deliberate test users). Confirm the original 3 policies remain.
5. Find the **Publishable key** (prefix `sb_publishable_`) in Supabase project settings > API Keys. Do NOT use secret/service-role keys. Enter it only in the pilot page, along with the adult test account password. Do not paste these values into GitHub Issues or chat.
6. The sign-in UI should show `Account verified` and `admin`. An unenrolled adult account should show `Awaiting Academy approval`. Reject wrong passwords. Test sign-out.
7. Clear saved pilot site data after tests. No student records, files, grade data, or payments are permitted.

## Invitation redirect note
The original public demo has no invitation handler. For test invitations once `pilot.html` is actually deployed, configure **Authentication > URL Configuration > Site URL** and allow `https://booksbigchange-rgb.github.io/Bigchange_Academy_Hub/pilot.html` as a Redirect URL. A previously used or expired invite link will not work a second time. Supabase `detectSessionInUrl: true` is required for implicit invite-session fragments.
Do not switch the Site URL yet unless pilot deployment is confirmed and tested.

## Real security tests not complete
- No authenticated read/write RLS integration tests have been conducted against the user's live database. Need multiple independent test accounts and proof that other users' rows are invisible.
- Need teacher/learner/guardian provisioning with proper class assignment and verified guardian linking.
- No school accounts for minors or payments should be entered.
- Test automation and production readiness are distinct from this code milestone.

## Source documentation
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/redirect-urls
