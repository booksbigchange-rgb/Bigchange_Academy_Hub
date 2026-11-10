-- DESIGN REVIEW ONLY: NOT APPLIED TO ANY SUPABASE PROJECT.
-- Apply after the initial deny-by-default Academy schema is reviewed and installed
-- in a DEDICATED Academy Supabase project; then execute role-isolation integration tests.
begin;
-- Explicit privileges: no anonymous access; authenticated users only receive
-- own-profile SELECT. All other Academy domain tables remain private.
revoke all on table
  public.academy_staff,
  public.academy_learners,
  public.academy_guardians,
  public.academy_guardian_links,
  public.academy_courses,
  public.academy_classes,
  public.academy_enrollments,
  public.academy_sessions,
  public.academy_attendance,
  public.academy_assignments,
  public.academy_submissions,
  public.academy_fee_obligations,
  public.academy_external_payments,
  public.academy_audit_events
from anon, authenticated;

grant select on table public.academy_staff,
  public.academy_learners,
  public.academy_guardians
to authenticated;

-- No INSERT/UPDATE/DELETE client policies. The backend will provision members.
create policy academy_staff_self_select
  on public.academy_staff for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy academy_learner_self_select
  on public.academy_learners for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy academy_guardian_self_select
  on public.academy_guardians for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- RLS ENABLE/FORCE is declared in the earlier schema draft for every table.
-- Never authorize via user_metadata or a React role picker.
commit;
