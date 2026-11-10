-- Manual TEST-ADMIN provisioning. Run ONLY in SQL Editor in the new Academy project.
-- Authentication > Users: choose an ADULT TEST USER whose email you control.
-- Do not paste real student or guardian email addresses or passwords.
-- The email should be CONFIRMED and the user must not have a learner/guardian profile.
-- Replace the placeholder ONCE with the exact test-user email, then review before Run.
-- Do not place this populated script in GitHub or send it to ChatGPT.
BEGIN;
DO $$
DECLARE
  target_email text := 'REPLACE_WITH_CONFIRMED_ADULT_TEST_EMAIL@example.com';
  target_id uuid;
BEGIN
  IF target_email = 'REPLACE_WITH_CONFIRMED_ADULT_TEST_EMAIL@example.com'
      OR position('@' in target_email) = 0
  THEN RAISE EXCEPTION 'Set a specific confirmed adult test email before running'; END IF;

  SELECT u.id INTO STRICT target_id
  FROM auth.users u
  WHERE lower(u.email) = lower(target_email)
    AND u.email_confirmed_at IS NOT NULL;

  IF EXISTS (SELECT 1 FROM public.academy_learners WHERE auth_user_id = target_id)
      OR EXISTS (SELECT 1 FROM public.academy_guardians WHERE auth_user_id = target_id)
  THEN RAISE EXCEPTION 'Cannot grant admin: account already has student/guardian membership'; END IF;

  INSERT INTO public.academy_staff (auth_user_id, role)
  VALUES (target_id, 'admin')
  ON CONFLICT (auth_user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.academy_staff
    WHERE auth_user_id = target_id AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Account already has another staff role; review manually'; END IF;
  RAISE NOTICE 'Confirmed adult test admin profile is provisioned';
EXCEPTION
  WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'No confirmed Auth user matches the test email';
  WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'More than one Auth user matches the test email';
END $$;
COMMIT;
-- SQL Editor success does not prove RLS access; run browser and multi-user tests.
