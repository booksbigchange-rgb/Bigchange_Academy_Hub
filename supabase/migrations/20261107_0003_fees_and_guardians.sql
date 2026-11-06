-- BigChange Academy — quarterly course fees, finance/admin approval, guardian contacts (migration 0003).
-- Apply in the dedicated Academy project AFTER 0001 and 0002. Not destructive: adds columns, functions, triggers;
-- replaces the fee-status view and the fee insert policy. Payments happen OUTSIDE this app; it only tracks status.
--
-- Rules implemented:
--  * One fee row per (student, course, quarter). `period` is the first month of the quarter (Jan/Apr/Jul/Oct).
--  * Finance records unpaid/partial/paid. Only an admin can approve. Approved status is what everyone else sees.
--  * Teachers get a read-only status for their own students in their own courses (RPC), never amounts or contacts of others.
--  * Teachers and admins can add guardian contacts for students they teach (RPC). Teacher-added links stay
--    UNVERIFIED until an admin verifies them; guardians cannot see a child until verified.
begin;

-- 1. Fee columns ---------------------------------------------------------------------------------------------
alter table public.academy_fee_obligations
  add column if not exists course_id uuid references public.academy_courses(id),
  add column if not exists guardian_id uuid references public.academy_guardians(id),
  add column if not exists recorded_status text not null default 'unpaid' check (recorded_status in ('unpaid','partial','paid')),
  add column if not exists recorded_by_staff_id uuid references public.academy_staff(id),
  add column if not exists recorded_at timestamptz,
  add column if not exists approved_status text not null default 'unpaid' check (approved_status in ('unpaid','partial','paid')),
  add column if not exists approved_by_staff_id uuid references public.academy_staff(id),
  add column if not exists approved_at timestamptz;

alter table public.academy_fee_obligations drop constraint if exists academy_fee_quarter_start;
alter table public.academy_fee_obligations add constraint academy_fee_quarter_start
  check (period is null or substr(period, 6, 2) in ('01','04','07','10'));
drop index if exists public.academy_fee_obligations_learner_period_uq;
create unique index if not exists academy_fee_obligations_learner_course_period_uq
  on public.academy_fee_obligations (learner_id, course_id, period) where period is not null and course_id is not null;

-- 2. Guardian contact checks ---------------------------------------------------------------------------------
alter table public.academy_guardians drop constraint if exists academy_guardian_phone_format;
alter table public.academy_guardians add constraint academy_guardian_phone_format
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
alter table public.academy_guardians drop constraint if exists academy_guardian_email_format;
alter table public.academy_guardians add constraint academy_guardian_email_format
  check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$'));

-- 3. Finance may read enrollments (needed to work out each family's course count) ----------------------------
drop policy if exists academy_enrollments_select on public.academy_enrollments;
create policy academy_enrollments_select on public.academy_enrollments for select to authenticated
  using (public.academy_is_finance() or public.academy_teaches_class(class_id)
         or learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(learner_id));

-- 4. Fee insert: new rows always start unpaid/unapproved -----------------------------------------------------
drop policy if exists academy_fees_insert on public.academy_fee_obligations;
create policy academy_fees_insert on public.academy_fee_obligations for insert to authenticated
  with check (public.academy_is_finance() and recorded_status = 'unpaid' and approved_status = 'unpaid'
              and approved_by_staff_id is null and recorded_by_staff_id is null);

-- 5. Guard: finance may change only the recorded status; only admin approves ---------------------------------
create or replace function public.academy_fee_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.learner_id, new.course_id, new.guardian_id, new.period, new.term, new.amount_due, new.currency_code)
     is distinct from (old.learner_id, old.course_id, old.guardian_id, old.period, old.term, old.amount_due, old.currency_code)
     and not public.academy_is_admin() then
    raise exception 'Only an administrator can change fee details';
  end if;
  if (new.approved_status, new.approved_by_staff_id, new.approved_at)
     is distinct from (old.approved_status, old.approved_by_staff_id, old.approved_at) then
    if not public.academy_is_admin() then raise exception 'Only an administrator can approve payment status'; end if;
    if new.approved_status not in (new.recorded_status, 'unpaid') then
      raise exception 'Approve only the status that finance recorded (or reset to unpaid)';
    end if;
    new.approved_by_staff_id := public.academy_staff_id();
    new.approved_at := now();
  end if;
  if new.recorded_status is distinct from old.recorded_status then
    new.recorded_by_staff_id := public.academy_staff_id();
    new.recorded_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.academy_fee_guard() from public, anon, authenticated;
drop trigger if exists academy_fee_guard_trg on public.academy_fee_obligations;
create trigger academy_fee_guard_trg before update on public.academy_fee_obligations
  for each row execute function public.academy_fee_guard();

-- 6. Status helper and view ----------------------------------------------------------------------------------
-- Overdue = not approved as paid and the quarter has ended (UTC).
create or replace function public.academy_fee_state(p_approved text, p_period text) returns text
language sql stable set search_path = '' as $$
  select case
    when p_approved = 'paid' then 'paid'
    when p_period is not null
         and (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '3 months')::date <= (now() at time zone 'utc')::date then 'overdue'
    else p_approved end $$;
grant execute on function public.academy_fee_state(text, text) to authenticated;

drop view if exists public.academy_fee_status;
create view public.academy_fee_status with (security_invoker = true) as
select o.id as obligation_id, o.learner_id, o.course_id, o.guardian_id, o.period, o.term, o.amount_due,
       o.recorded_status, o.approved_status,
       public.academy_fee_state(o.approved_status, o.period) as status,
       (o.recorded_status <> o.approved_status) as pending_approval,
       o.recorded_at, o.approved_at
from public.academy_fee_obligations o;
revoke all on public.academy_fee_status from anon, authenticated;
grant select on public.academy_fee_status to authenticated;

-- 7. Teacher read-only fee status: own students, only courses the teacher teaches, approved status only --------
create or replace function public.academy_teacher_fee_status()
returns table (learner_id uuid, course_id uuid, period text, status text)
language sql stable security definer set search_path = '' as $$
  select o.learner_id, o.course_id, o.period, public.academy_fee_state(o.approved_status, o.period)
  from public.academy_fee_obligations o
  where public.academy_staff_role() in ('admin', 'teacher')
    and (public.academy_is_admin() or exists (
      select 1 from public.academy_enrollments e
      join public.academy_classes c on c.id = e.class_id
      where e.learner_id = o.learner_id and c.course_id = o.course_id
        and c.teacher_staff_id = public.academy_staff_id())) $$;
revoke execute on function public.academy_teacher_fee_status() from public, anon;
grant execute on function public.academy_teacher_fee_status() to authenticated;

-- 8. Guardian contacts for students a staff member may manage ------------------------------------------------
create or replace function public.academy_add_guardian(
  p_learner uuid, p_name text, p_email text, p_phone text, p_email_opt boolean, p_whatsapp_opt boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_name text := btrim(coalesce(p_name, ''));
        v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
        v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
        v_id uuid; v_verified uuid;
begin
  if not (public.academy_is_admin() or public.academy_teaches_learner(p_learner)) then
    raise exception 'Not allowed to add a guardian for this student' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_name ~ '[<>]' then raise exception 'Enter the guardian name (2 to 80 characters)'; end if;
  if v_email is null and v_phone is null then raise exception 'Enter a phone number or an email address'; end if;
  select g.id into v_id from public.academy_guardians g
    where (v_email is not null and lower(g.email) = v_email) or (v_phone is not null and g.phone_e164 = v_phone) limit 1;
  if v_id is null then
    insert into public.academy_guardians(display_name, email, phone_e164, email_opt_in, whatsapp_opt_in)
    values (v_name, v_email, v_phone, coalesce(p_email_opt, false), coalesce(p_whatsapp_opt, false)) returning id into v_id;
  end if;
  v_verified := case when public.academy_is_admin() then public.academy_staff_id() else null end;
  insert into public.academy_guardian_links(learner_id, guardian_id, verified_by_staff_id)
  values (p_learner, v_id, v_verified) on conflict (learner_id, guardian_id) do nothing;
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), 'ADD_GUARDIAN', 'academy_guardians', v_id::text, jsonb_build_object('learner_id', p_learner));
  return v_id;
end $$;
revoke execute on function public.academy_add_guardian(uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.academy_add_guardian(uuid, text, text, text, boolean, boolean) to authenticated;

create or replace function public.academy_guardians_for_learner(p_learner uuid)
returns table (guardian_id uuid, display_name text, email text, phone_e164 text,
               email_opt_in boolean, whatsapp_opt_in boolean, verified boolean)
language sql stable security definer set search_path = '' as $$
  select g.id, g.display_name, g.email, g.phone_e164, g.email_opt_in, g.whatsapp_opt_in,
         (l.verified_by_staff_id is not null)
  from public.academy_guardian_links l join public.academy_guardians g on g.id = l.guardian_id
  where l.learner_id = p_learner and (public.academy_is_finance() or public.academy_teaches_learner(p_learner)) $$;
revoke execute on function public.academy_guardians_for_learner(uuid) from public, anon;
grant execute on function public.academy_guardians_for_learner(uuid) to authenticated;

commit;
-- Then re-run supabase/checks/verify_academy_readonly.sql and test with separate admin, finance and teacher TEST accounts.
