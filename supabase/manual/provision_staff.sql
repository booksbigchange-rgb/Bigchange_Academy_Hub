-- Manual staff provisioning (teacher or finance). Run ONLY in the SQL Editor of the Academy project.
-- 1. Authentication > Users: create the staff member's login (confirmed email, password 12+ characters).
-- 2. Copy this file into a PRIVATE SQL Editor tab (do not edit it in GitHub or commit the edited copy).
-- 3. Change ONLY the three values in the `target_...` lines below. Leave the placeholder text in the IF checks as it is.
-- Admin accounts: use provision_test_admin.sql.
BEGIN;
DO $$
DECLARE
  target_email text := 'REPLACE_WITH_STAFF_EMAIL@example.com';
  target_role text := 'teacher';            -- 'teacher' or 'finance'
  target_name text := 'REPLACE_WITH_DISPLAY_NAME';
  target_id uuid;
BEGIN
  IF target_email = 'REPLACE_WITH_STAFF_EMAIL@example.com' OR position('@' in target_email) = 0
     OR target_name = 'REPLACE_WITH_DISPLAY_NAME' OR char_length(btrim(target_name)) < 2
  THEN RAISE EXCEPTION 'Set the staff email and display name before running'; END IF;
  IF target_role NOT IN ('teacher', 'finance') THEN RAISE EXCEPTION 'Role must be teacher or finance'; END IF;

  SELECT u.id INTO STRICT target_id FROM auth.users u
  WHERE lower(u.email) = lower(target_email) AND u.email_confirmed_at IS NOT NULL;

  IF EXISTS (SELECT 1 FROM public.academy_learners WHERE auth_user_id = target_id)
     OR EXISTS (SELECT 1 FROM public.academy_guardians WHERE auth_user_id = target_id)
  THEN RAISE EXCEPTION 'This account is already a student or guardian'; END IF;

  INSERT INTO public.academy_staff (auth_user_id, role, display_name)
  VALUES (target_id, target_role, btrim(target_name))
  ON CONFLICT (auth_user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.academy_staff WHERE auth_user_id = target_id AND role = target_role)
  THEN RAISE EXCEPTION 'Account already has a different staff role; review manually'; END IF;
  RAISE NOTICE 'Staff profile provisioned';
EXCEPTION
  WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'No confirmed Auth user matches that email';
  WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'More than one Auth user matches that email';
END $$;
COMMIT;
