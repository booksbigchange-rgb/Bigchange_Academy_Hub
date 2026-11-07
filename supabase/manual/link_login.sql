-- Link an existing Auth login to an existing guardian (parent) or student record. Run ONLY in the SQL Editor.
-- 1. Authentication > Users: create the login (confirmed email, password 12+ characters). Give the person the password yourself.
-- 2. The guardian/student must already exist in the app (added under Guardians / Students).
-- 3. Copy this file into a PRIVATE query tab. Change ONLY the three target_ lines. Leave the placeholder text in the IF check.
-- Staff logins use provision_staff.sql / provision_test_admin.sql instead.
BEGIN;
DO $$
DECLARE
  target_email text := 'REPLACE_WITH_LOGIN_EMAIL@example.com';  -- the Auth user's email
  target_kind  text := 'guardian';                             -- 'guardian' or 'learner'
  target_record_email text := 'REPLACE_WITH_RECORD_EMAIL@example.com'; -- guardian: the email saved on the guardian record; learner: use the student's exact name in target_record_name instead
  target_record_name  text := '';                              -- learner only: the student's exact name (must match exactly one student)
  target_id uuid; rows_changed integer;
BEGIN
  IF target_email = 'REPLACE_WITH_LOGIN_EMAIL@example.com' OR position('@' in target_email) = 0 THEN RAISE EXCEPTION 'Set the login email first'; END IF;
  IF target_kind NOT IN ('guardian', 'learner') THEN RAISE EXCEPTION 'Kind must be guardian or learner'; END IF;
  SELECT u.id INTO STRICT target_id FROM auth.users u WHERE lower(u.email) = lower(target_email) AND u.email_confirmed_at IS NOT NULL;
  IF EXISTS (SELECT 1 FROM public.academy_staff WHERE auth_user_id = target_id) THEN RAISE EXCEPTION 'This login is a staff account'; END IF;
  IF target_kind = 'guardian' THEN
    IF target_record_email = 'REPLACE_WITH_RECORD_EMAIL@example.com' THEN RAISE EXCEPTION 'Set the guardian record email'; END IF;
    IF EXISTS (SELECT 1 FROM public.academy_learners WHERE auth_user_id = target_id) THEN RAISE EXCEPTION 'This login is already a student'; END IF;
    UPDATE public.academy_guardians SET auth_user_id = target_id
      WHERE lower(email) = lower(target_record_email) AND auth_user_id IS NULL;
  ELSE
    IF char_length(btrim(target_record_name)) < 2 THEN RAISE EXCEPTION 'Set the exact student name'; END IF;
    IF EXISTS (SELECT 1 FROM public.academy_guardians WHERE auth_user_id = target_id) THEN RAISE EXCEPTION 'This login is already a guardian'; END IF;
    UPDATE public.academy_learners SET auth_user_id = target_id
      WHERE display_name = btrim(target_record_name) AND auth_user_id IS NULL;
  END IF;
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  IF rows_changed <> 1 THEN RAISE EXCEPTION 'Expected to link exactly one record, linked %; nothing was changed', rows_changed; END IF;
  RAISE NOTICE 'Login linked';
EXCEPTION
  WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'No confirmed Auth user matches that email';
END $$;
COMMIT;
