-- BigChange Academy — access rules (migration 0002).
-- Apply ONLY in the NEW dedicated Academy Supabase project, AFTER 20261015_0001_locked_schema.sql.
-- Prerequisite: the table owner role must bypass RLS (true for `postgres` on Supabase). Check:
--   select rolbypassrls from pg_roles where rolname = 'postgres';   -- must be true
-- Run once in the SQL Editor. It supersedes supabase/policies/academy_profile_access.sql
-- (do not run that file as well). It is not destructive: it adds columns, a view, functions,
-- triggers and policies, and only drops policies that start with "academy_".
--
-- Roles (academy_staff.role): admin, teacher, finance. Learners and guardians are separate tables.
-- Authorization comes from these tables via auth.uid(); never from user_metadata or the UI.
-- Staff accounts are provisioned manually (supabase/manual/provision_test_admin.sql); there are no
-- client INSERT/UPDATE/DELETE policies on academy_staff.
begin;

-- ---------------------------------------------------------------------------
-- 1. Small, additive schema changes needed by the app
-- ---------------------------------------------------------------------------
alter table public.academy_fee_obligations add column if not exists period text
  check (period is null or period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$');
create unique index if not exists academy_fee_obligations_learner_period_uq
  on public.academy_fee_obligations (learner_id, period) where period is not null;
alter table public.academy_attendance add column if not exists recorded_at timestamptz not null default now();
alter table public.academy_audit_events add column if not exists entity_id text;
alter table public.academy_audit_events add column if not exists detail jsonb;
alter table public.academy_learners add column if not exists grade_level text
  check (grade_level is null or grade_level in ('Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10'));
alter table public.academy_learners add column if not exists note text check (note is null or char_length(note) <= 120);
alter table public.academy_staff add column if not exists display_name text;
alter table public.academy_staff add column if not exists specialty text check (specialty is null or char_length(specialty) <= 40);

-- ---------------------------------------------------------------------------
-- 2. Remove any earlier Academy policies so this file is the single source of truth
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename like 'academy\_%' escape '\' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Helper functions. SECURITY DEFINER so policies never recurse through other RLS tables.
--    Fixed search_path; callable only by signed-in users.
-- ---------------------------------------------------------------------------
create or replace function public.academy_staff_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.academy_staff where auth_user_id = (select auth.uid()) $$;

create or replace function public.academy_staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.academy_staff where auth_user_id = (select auth.uid()) $$;

create or replace function public.academy_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.academy_staff_role() = 'admin', false) $$;

create or replace function public.academy_is_finance() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.academy_staff_role() in ('admin','finance'), false) $$;

create or replace function public.academy_my_learner_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.academy_learners where auth_user_id = (select auth.uid()) $$;

create or replace function public.academy_is_guardian_of(p_learner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.academy_guardians g
    join public.academy_guardian_links l on l.guardian_id = g.id
    where g.auth_user_id = (select auth.uid()) and l.learner_id = p_learner
      and l.verified_by_staff_id is not null) $$;

create or replace function public.academy_teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.academy_classes c
    where c.id = p_class and c.teacher_staff_id = public.academy_staff_id()) $$;

create or replace function public.academy_teaches_learner(p_learner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.academy_enrollments e
    join public.academy_classes c on c.id = e.class_id
    where e.learner_id = p_learner and c.teacher_staff_id = public.academy_staff_id()) $$;

create or replace function public.academy_learner_in_class(p_class uuid, p_learner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.academy_enrollments e where e.class_id = p_class and e.learner_id = p_learner) $$;

-- Can the signed-in user see this class? (admin, its teacher, an enrolled learner, or a verified guardian)
create or replace function public.academy_can_see_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.academy_is_admin()
    or public.academy_teaches_class(p_class)
    or exists (select 1 from public.academy_enrollments e
        where e.class_id = p_class
          and (e.learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(e.learner_id))) $$;

create or replace function public.academy_session_class(p_session uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.academy_sessions where id = p_session $$;

create or replace function public.academy_assignment_class(p_assignment uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.academy_assignments where id = p_assignment $$;

create or replace function public.academy_obligation_learner(p_obligation uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select learner_id from public.academy_fee_obligations where id = p_obligation $$;

revoke execute on function
  public.academy_staff_id(), public.academy_staff_role(), public.academy_is_admin(), public.academy_is_finance(),
  public.academy_my_learner_id(), public.academy_is_guardian_of(uuid), public.academy_teaches_class(uuid),
  public.academy_teaches_learner(uuid), public.academy_learner_in_class(uuid,uuid), public.academy_can_see_class(uuid),
  public.academy_session_class(uuid), public.academy_assignment_class(uuid), public.academy_obligation_learner(uuid)
from public, anon;
grant execute on function
  public.academy_staff_id(), public.academy_staff_role(), public.academy_is_admin(), public.academy_is_finance(),
  public.academy_my_learner_id(), public.academy_is_guardian_of(uuid), public.academy_teaches_class(uuid),
  public.academy_teaches_learner(uuid), public.academy_learner_in_class(uuid,uuid), public.academy_can_see_class(uuid),
  public.academy_session_class(uuid), public.academy_assignment_class(uuid), public.academy_obligation_learner(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Table privileges: nothing for anon; RLS (below) decides rows for authenticated.
--    No DELETE on learners/guardians/fees/payments/audit: records are deactivated, never erased.
-- ---------------------------------------------------------------------------
revoke all on table public.academy_staff, public.academy_learners, public.academy_guardians,
  public.academy_guardian_links, public.academy_courses, public.academy_classes, public.academy_enrollments,
  public.academy_sessions, public.academy_attendance, public.academy_assignments, public.academy_submissions,
  public.academy_fee_obligations, public.academy_external_payments, public.academy_audit_events
from anon, authenticated;

grant select on public.academy_staff, public.academy_guardian_links, public.academy_audit_events,
  public.academy_enrollments to authenticated;
grant select, insert, update on public.academy_learners, public.academy_guardians, public.academy_courses,
  public.academy_classes, public.academy_sessions, public.academy_attendance, public.academy_assignments,
  public.academy_submissions, public.academy_fee_obligations to authenticated;
grant select, insert, update on public.academy_external_payments to authenticated;
grant insert, delete on public.academy_enrollments to authenticated;
grant insert, update, delete on public.academy_guardian_links to authenticated;
grant update (display_name, specialty) on public.academy_staff to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security policies
-- ---------------------------------------------------------------------------
-- Staff: see own row; admin sees all; may edit own display name/specialty only (column grant above).
create policy academy_staff_select on public.academy_staff for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.academy_is_admin());
create policy academy_staff_update_self on public.academy_staff for update to authenticated
  using (auth_user_id = (select auth.uid()) or public.academy_is_admin())
  with check (auth_user_id = (select auth.uid()) or public.academy_is_admin());

-- Learners
create policy academy_learners_select on public.academy_learners for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.academy_is_finance()
         or public.academy_teaches_learner(id) or public.academy_is_guardian_of(id));
create policy academy_learners_insert on public.academy_learners for insert to authenticated
  with check (public.academy_is_admin());
create policy academy_learners_update on public.academy_learners for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin());

-- Guardians (contact details and consent flags: admin/finance and the guardian themself)
create policy academy_guardians_select on public.academy_guardians for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.academy_is_finance());
create policy academy_guardians_insert on public.academy_guardians for insert to authenticated
  with check (public.academy_is_admin());
create policy academy_guardians_update on public.academy_guardians for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin());

-- Guardian links: staff verification is recorded; only admin manages links.
create policy academy_links_select on public.academy_guardian_links for select to authenticated
  using (public.academy_is_finance() or exists (select 1 from public.academy_guardians g
         where g.id = guardian_id and g.auth_user_id = (select auth.uid())));
create policy academy_links_insert on public.academy_guardian_links for insert to authenticated
  with check (public.academy_is_admin() and verified_by_staff_id = public.academy_staff_id());
create policy academy_links_update on public.academy_guardian_links for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin() and verified_by_staff_id is not null);
create policy academy_links_delete on public.academy_guardian_links for delete to authenticated
  using (public.academy_is_admin());

-- Courses: readable by any signed-in Academy member; admin manages.
create policy academy_courses_select on public.academy_courses for select to authenticated
  using (public.academy_staff_id() is not null or public.academy_my_learner_id() is not null
         or exists (select 1 from public.academy_guardians g where g.auth_user_id = (select auth.uid())));
create policy academy_courses_insert on public.academy_courses for insert to authenticated
  with check (public.academy_is_admin());
create policy academy_courses_update on public.academy_courses for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin());

-- Classes
create policy academy_classes_select on public.academy_classes for select to authenticated
  using (public.academy_can_see_class(id) or public.academy_is_finance());
create policy academy_classes_insert on public.academy_classes for insert to authenticated
  with check (public.academy_is_admin());
create policy academy_classes_update on public.academy_classes for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin());

-- Enrollments: admin manages; others read only their own scope.
create policy academy_enrollments_select on public.academy_enrollments for select to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(class_id)
         or learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(learner_id));
create policy academy_enrollments_insert on public.academy_enrollments for insert to authenticated
  with check (public.academy_is_admin());
create policy academy_enrollments_delete on public.academy_enrollments for delete to authenticated
  using (public.academy_is_admin());

-- Sessions (dated lessons): admin or the class's teacher manage; those who see the class read.
create policy academy_sessions_select on public.academy_sessions for select to authenticated
  using (public.academy_can_see_class(class_id));
create policy academy_sessions_insert on public.academy_sessions for insert to authenticated
  with check (public.academy_is_admin() or public.academy_teaches_class(class_id));
create policy academy_sessions_update on public.academy_sessions for update to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(class_id))
  with check (public.academy_is_admin() or public.academy_teaches_class(class_id));

-- Attendance: only for enrolled learners; unique (session, learner) is the primary key.
create policy academy_attendance_select on public.academy_attendance for select to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(public.academy_session_class(session_id))
         or learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(learner_id));
create policy academy_attendance_insert on public.academy_attendance for insert to authenticated
  with check ((public.academy_is_admin() or public.academy_teaches_class(public.academy_session_class(session_id)))
         and public.academy_learner_in_class(public.academy_session_class(session_id), learner_id)
         and recorded_by_staff_id = public.academy_staff_id());
create policy academy_attendance_update on public.academy_attendance for update to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(public.academy_session_class(session_id)))
  with check ((public.academy_is_admin() or public.academy_teaches_class(public.academy_session_class(session_id)))
         and public.academy_learner_in_class(public.academy_session_class(session_id), learner_id)
         and recorded_by_staff_id = public.academy_staff_id());

-- Assignments
create policy academy_assignments_select on public.academy_assignments for select to authenticated
  using (public.academy_can_see_class(class_id));
create policy academy_assignments_insert on public.academy_assignments for insert to authenticated
  with check (public.academy_is_admin() or public.academy_teaches_class(class_id));
create policy academy_assignments_update on public.academy_assignments for update to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(class_id))
  with check (public.academy_is_admin() or public.academy_teaches_class(class_id));

-- Submissions: a learner submits their own work for a class they are in; staff review.
create policy academy_submissions_select on public.academy_submissions for select to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(public.academy_assignment_class(assignment_id))
         or learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(learner_id));
create policy academy_submissions_insert on public.academy_submissions for insert to authenticated
  with check (learner_id = public.academy_my_learner_id() and status = 'submitted'
         and public.academy_learner_in_class(public.academy_assignment_class(assignment_id), learner_id));
create policy academy_submissions_update on public.academy_submissions for update to authenticated
  using (public.academy_is_admin() or public.academy_teaches_class(public.academy_assignment_class(assignment_id)))
  with check (public.academy_is_admin() or public.academy_teaches_class(public.academy_assignment_class(assignment_id)));

-- Fee obligations (payment tracking only; no money moves here): admin/finance manage; guardians read own children.
create policy academy_fees_select on public.academy_fee_obligations for select to authenticated
  using (public.academy_is_finance() or public.academy_is_guardian_of(learner_id));
create policy academy_fees_insert on public.academy_fee_obligations for insert to authenticated
  with check (public.academy_is_finance());
create policy academy_fees_update on public.academy_fee_obligations for update to authenticated
  using (public.academy_is_finance()) with check (public.academy_is_finance());

-- Externally recorded payments: finance/admin record; only admin may verify (update); never deleted.
create policy academy_payments_select on public.academy_external_payments for select to authenticated
  using (public.academy_is_finance()
         or public.academy_is_guardian_of(public.academy_obligation_learner(obligation_id)));
create policy academy_payments_insert on public.academy_external_payments for insert to authenticated
  with check (public.academy_is_finance() and recorded_by_staff_id = public.academy_staff_id()
              and verified_by_staff_id is null);
create policy academy_payments_update on public.academy_external_payments for update to authenticated
  using (public.academy_is_admin())
  with check (public.academy_is_admin() and (verified_by_staff_id is null or verified_by_staff_id = public.academy_staff_id()));

-- Audit trail: admin reads; rows are written only by the triggers below.
create policy academy_audit_select on public.academy_audit_events for select to authenticated
  using (public.academy_is_admin());

-- ---------------------------------------------------------------------------
-- 6. Audit triggers (append-only; clients have no INSERT/UPDATE/DELETE on the audit table)
-- ---------------------------------------------------------------------------
create or replace function public.academy_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rec jsonb;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), tg_op, tg_table_name,
          coalesce(rec->>'id', rec->>'session_id', rec->>'class_id'),
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
               else rec end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.academy_audit() from public, anon, authenticated;

drop trigger if exists academy_audit_fees on public.academy_fee_obligations;
create trigger academy_audit_fees after insert or update on public.academy_fee_obligations
  for each row execute function public.academy_audit();
drop trigger if exists academy_audit_payments on public.academy_external_payments;
create trigger academy_audit_payments after insert or update on public.academy_external_payments
  for each row execute function public.academy_audit();
drop trigger if exists academy_audit_attendance on public.academy_attendance;
create trigger academy_audit_attendance after insert or update on public.academy_attendance
  for each row execute function public.academy_audit();
drop trigger if exists academy_audit_enrollments on public.academy_enrollments;
create trigger academy_audit_enrollments after insert or delete on public.academy_enrollments
  for each row execute function public.academy_audit();
drop trigger if exists academy_audit_links on public.academy_guardian_links;
create trigger academy_audit_links after insert or update or delete on public.academy_guardian_links
  for each row execute function public.academy_audit();

-- ---------------------------------------------------------------------------
-- 7. Fee status view (Paid / Overdue / Partial / Unpaid), evaluated with the caller's rights.
--    Overdue = not fully paid and the fee month is before the current UTC month (policy assumption).
-- ---------------------------------------------------------------------------
create or replace view public.academy_fee_status with (security_invoker = true) as
select o.id as obligation_id, o.learner_id, o.term, o.period, o.amount_due,
       coalesce(sum(p.amount), 0) as amount_recorded,
       case
         when coalesce(sum(p.amount), 0) >= o.amount_due then 'paid'
         when o.period is not null and o.period < to_char(now() at time zone 'utc', 'YYYY-MM') then 'overdue'
         when coalesce(sum(p.amount), 0) > 0 then 'partial'
         else 'unpaid'
       end as status
from public.academy_fee_obligations o
left join public.academy_external_payments p on p.obligation_id = o.id
group by o.id;
revoke all on public.academy_fee_status from anon, authenticated;
grant select on public.academy_fee_status to authenticated;

commit;
-- SQL Editor success does not prove access control. Run supabase/checks/verify_academy_readonly.sql,
-- then test with real separate admin, teacher, finance, learner and guardian TEST accounts.
