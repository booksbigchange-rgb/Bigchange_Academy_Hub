-- BigChange Academy — faster attendance and lesson rules (migration 0009). Run after 0001–0008. Safe to re-run.
-- Same rules as before, written so the database works out "which lessons / children are mine" ONCE per query
-- instead of once per row. On a test database sized for the plan (3,000 students, about a year of lessons =
-- 288,000 attendance rows) a teacher's own attendance query took 18.8 s before and 0.39 s after; an admin's took 7.3 s and 0.08 s.
-- Who can see what does not change: admin sees all; a teacher sees their own classes' lessons and marks; a student sees
-- their own; a parent sees the marks of a child they are VERIFIED for.
begin;

-- Lessons (sessions) of every class the signed-in user may see, as one list.
create or replace function public.academy_my_class_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.class_id), '{}'::uuid[]) from (
    select c.id as class_id from public.academy_classes c where c.teacher_staff_id = public.academy_staff_id()
    union all
    select e.class_id from public.academy_enrollments e where e.learner_id = public.academy_my_learner_id()
    union all
    select e.class_id from public.academy_enrollments e
      join public.academy_guardian_links l on l.learner_id = e.learner_id and l.verified_by_staff_id is not null
      join public.academy_guardians g on g.id = l.guardian_id
      where g.auth_user_id = (select auth.uid())
  ) x $$;

-- Sessions of the classes the signed-in staff member teaches.
create or replace function public.academy_my_session_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(s.id), '{}'::uuid[]) from public.academy_sessions s
  join public.academy_classes c on c.id = s.class_id
  where c.teacher_staff_id = public.academy_staff_id() $$;

-- Children the signed-in parent is verified for.
create or replace function public.academy_my_child_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(l.learner_id), '{}'::uuid[]) from public.academy_guardian_links l
  join public.academy_guardians g on g.id = l.guardian_id
  where g.auth_user_id = (select auth.uid()) and l.verified_by_staff_id is not null $$;

revoke execute on function public.academy_my_class_ids(), public.academy_my_session_ids(), public.academy_my_child_ids() from public, anon;
grant execute on function public.academy_my_class_ids(), public.academy_my_session_ids(), public.academy_my_child_ids() to authenticated;

drop policy if exists academy_attendance_select on public.academy_attendance;
create policy academy_attendance_select on public.academy_attendance for select to authenticated
  using ((select public.academy_is_admin())
         or session_id = any ((select public.academy_my_session_ids())::uuid[])
         or learner_id = (select public.academy_my_learner_id())
         or learner_id = any ((select public.academy_my_child_ids())::uuid[]));

drop policy if exists academy_sessions_select on public.academy_sessions;
create policy academy_sessions_select on public.academy_sessions for select to authenticated
  using ((select public.academy_is_admin())
         or class_id = any ((select public.academy_my_class_ids())::uuid[]));

commit;
