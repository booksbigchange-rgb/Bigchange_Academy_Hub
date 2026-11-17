-- BigChange Academy — migration 0010: the admin manages staff roles inside the app.
-- Run in the Academy project's SQL Editor AFTER 0001–0009. Safe to run again. No new tables, no new policies
-- (the verify script still expects 17 tables and 46 policies).
--
-- What it does
--  * academy_staff.active: an admin can switch a staff member's access off (and on again). Staff rows are never
--    deleted, because payments, attendance and classes point to them.
--  * A switched-off person has no rights at all: academy_staff_id() and academy_staff_role() return nothing for them,
--    so every policy and function that relies on them refuses. They cannot see their own staff row either, so the app
--    shows "no role assigned".
--  * academy_staff_directory(): admin only. Lists every confirmed login that is not a student or parent, with its
--    email, staff role (if any), access and number of classes. Logins without a role are "waiting for a role".
--  * academy_set_staff_role(user, role, name): admin only. Gives or changes a role (teacher, finance, admin) and
--    switches access on. An admin cannot change their own role (so the school never locks itself out); a teacher
--    who still has classes cannot be moved to another role until those classes have a new teacher.
--  * academy_set_staff_active(staff, active): admin only; not for yourself.
--  * Every change to a staff row is written to the audit trail.
-- Staff still cannot change roles by editing the table directly: only display_name/specialty are writable (0002).
begin;

alter table public.academy_staff add column if not exists active boolean not null default true;

-- Switched-off staff have no role.
create or replace function public.academy_staff_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.academy_staff where auth_user_id = (select auth.uid()) and active $$;

create or replace function public.academy_staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.academy_staff where auth_user_id = (select auth.uid()) and active $$;

-- Own row visible (and its name editable) only while active; admin sees and edits names of all.
drop policy if exists academy_staff_select on public.academy_staff;
create policy academy_staff_select on public.academy_staff for select to authenticated
  using ((auth_user_id = (select auth.uid()) and active) or public.academy_is_admin());
drop policy if exists academy_staff_update_self on public.academy_staff;
create policy academy_staff_update_self on public.academy_staff for update to authenticated
  using ((auth_user_id = (select auth.uid()) and active) or public.academy_is_admin())
  with check ((auth_user_id = (select auth.uid()) and active) or public.academy_is_admin());

create or replace function public.academy_staff_directory()
returns table(user_id uuid, email text, staff_id uuid, display_name text, role text, active boolean, class_count integer, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.academy_is_admin() then
    raise exception 'Only an administrator can manage staff' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, s.id, s.display_name, s.role, coalesce(s.active, false),
           (select count(*)::integer from public.academy_classes c where s.id is not null and c.teacher_staff_id = s.id),
           u.last_sign_in_at
    from auth.users u
    left join public.academy_staff s on s.auth_user_id = u.id
    where u.email_confirmed_at is not null and u.deleted_at is null
      and not exists (select 1 from public.academy_learners l where l.auth_user_id = u.id)
      and not exists (select 1 from public.academy_guardians g where g.auth_user_id = u.id)
    order by (s.id is null) desc, lower(coalesce(s.display_name, u.email::text)), u.id;
end $$;

create or replace function public.academy_set_staff_role(p_user uuid, p_role text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_old public.academy_staff%rowtype;
  v_id uuid;
begin
  if not public.academy_is_admin() then
    raise exception 'Only an administrator can manage staff' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'teacher', 'finance') then
    raise exception 'Choose teacher, finance or admin';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter the person''s name (2 to 80 characters)';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own role. Ask another administrator.';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null and u.deleted_at is null) then
    raise exception 'Login not found. Add the person under Supabase Authentication first.';
  end if;
  if exists (select 1 from public.academy_learners where auth_user_id = p_user)
     or exists (select 1 from public.academy_guardians where auth_user_id = p_user) then
    raise exception 'This login belongs to a student or parent';
  end if;
  select * into v_old from public.academy_staff where auth_user_id = p_user;
  if found and v_old.role = 'teacher' and p_role <> 'teacher'
     and exists (select 1 from public.academy_classes where teacher_staff_id = v_old.id) then
    raise exception 'This teacher still has classes. Give those classes another teacher first.';
  end if;
  insert into public.academy_staff (auth_user_id, role, display_name, active)
  values (p_user, p_role, v_name, true)
  on conflict (auth_user_id) do update set role = excluded.role, display_name = excluded.display_name, active = true
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.academy_set_staff_active(p_staff uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.academy_is_admin() then
    raise exception 'Only an administrator can manage staff' using errcode = '42501';
  end if;
  if p_active is null then raise exception 'Choose on or off'; end if;
  select auth_user_id into v_user from public.academy_staff where id = p_staff;
  if not found then raise exception 'Staff member not found'; end if;
  if v_user = (select auth.uid()) then
    raise exception 'You cannot switch off your own access. Ask another administrator.';
  end if;
  update public.academy_staff set active = p_active where id = p_staff;
end $$;

revoke execute on function public.academy_staff_directory(), public.academy_set_staff_role(uuid, text, text),
  public.academy_set_staff_active(uuid, boolean) from public, anon;
grant execute on function public.academy_staff_directory(), public.academy_set_staff_role(uuid, text, text),
  public.academy_set_staff_active(uuid, boolean) to authenticated;

drop trigger if exists academy_audit_staff on public.academy_staff;
create trigger academy_audit_staff after insert or update on public.academy_staff
  for each row execute function public.academy_audit();

commit;
