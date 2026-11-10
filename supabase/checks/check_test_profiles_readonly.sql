-- Read-only checks. Execute in NEW Academy project after creating test identities.
-- No names, emails or other personal data are displayed.
SELECT
  (SELECT count(*) FROM public.academy_staff WHERE role='admin') AS test_admin_profiles,
  (SELECT count(*) FROM public.academy_staff WHERE role='teacher') AS test_teacher_profiles,
  (SELECT count(*) FROM public.academy_learners) AS test_learner_profiles,
  (SELECT count(*) FROM public.academy_guardians) AS test_guardian_profiles,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'academy_%') AS total_policies;
-- Expect 3 policies at this stage. All non-identity tables remain unavailable.
