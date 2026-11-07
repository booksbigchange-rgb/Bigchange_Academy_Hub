-- BigChange Academy — parent payment periods, teacher/finance/admin workflow, guardian contacts (migration 0003).
-- Apply in the dedicated Academy project AFTER 0001 and 0002. Safe to re-run. Not destructive.
-- Payments happen OUTSIDE this app; it only tracks status, payment date and how it was paid. Currency: USD.
--
-- Model (owner's rules):
--  * One record per PARENT (guardian) per 3-month period, with that parent's own start and end dates.
--  * Amount covers all of the parent's children: USD 150 if the family has exactly one course in total,
--    otherwise USD 100 per course (courses counted per child). Computed in SQL, not trusted from the browser.
--  * Workflow: a form teacher (or finance/admin) REPORTS what was paid (date, method, note); finance CHECKS it;
--    an administrator APPROVES it. Changing the report resets the check and approval.
--  * Because the record belongs to the parent, every teacher of any of that parent's children sees the same update.
--  * Teacher-added guardian links stay unverified until an admin verifies them; guardians see a child only when verified.
begin;

-- 1. Guardian contact checks; one guardian per phone number ----------------------------------------------------
alter table public.academy_guardians drop constraint if exists academy_guardian_phone_format;
alter table public.academy_guardians add constraint academy_guardian_phone_format
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
alter table public.academy_guardians drop constraint if exists academy_guardian_email_format;
alter table public.academy_guardians add constraint academy_guardian_email_format
  check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$'));
create unique index if not exists academy_guardians_phone_uq on public.academy_guardians (phone_e164) where phone_e164 is not null;
create unique index if not exists academy_guardians_email_uq on public.academy_guardians (lower(email)) where email is not null;

-- 2. Finance may read enrollments (to show each family's courses) ---------------------------------------------
drop policy if exists academy_enrollments_select on public.academy_enrollments;
create policy academy_enrollments_select on public.academy_enrollments for select to authenticated
  using (public.academy_is_finance() or public.academy_teaches_class(class_id)
         or learner_id = public.academy_my_learner_id() or public.academy_is_guardian_of(learner_id));

-- 3. Payment periods ---------------------------------------------------------------------------------------------
create table if not exists public.academy_fee_periods (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.academy_guardians(id),
  period_start date not null,
  period_end date not null,
  course_count integer not null check (course_count >= 1),
  amount_due numeric(12,2) not null check (amount_due > 0),
  currency_code text not null default 'USD' check (currency_code = 'USD'),
  reported_status text not null default 'unpaid' check (reported_status in ('unpaid','partial','paid')),
  paid_on date,
  paid_method text check (paid_method in ('cash','bank','mobile_money','other')),
  paid_note text check (paid_note is null or char_length(paid_note) <= 120),
  reported_by_staff_id uuid references public.academy_staff(id),
  reported_at timestamptz,
  checked_status text not null default 'unpaid' check (checked_status in ('unpaid','partial','paid')),
  checked_by_staff_id uuid references public.academy_staff(id),
  checked_at timestamptz,
  approved_status text not null default 'unpaid' check (approved_status in ('unpaid','partial','paid')),
  approved_by_staff_id uuid references public.academy_staff(id),
  approved_at timestamptz,
  created_by_staff_id uuid references public.academy_staff(id),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  check (reported_status = 'unpaid' or (paid_on is not null and paid_method is not null)),
  unique (guardian_id, period_start)
);
alter table public.academy_fee_periods enable row level security;
alter table public.academy_fee_periods force row level security;
revoke all on public.academy_fee_periods from anon, authenticated;
grant select, update on public.academy_fee_periods to authenticated;

drop policy if exists academy_periods_select on public.academy_fee_periods;
create policy academy_periods_select on public.academy_fee_periods for select to authenticated
  using (public.academy_is_finance() or exists (select 1 from public.academy_guardians g
         where g.id = guardian_id and g.auth_user_id = (select auth.uid())));
drop policy if exists academy_periods_update on public.academy_fee_periods;
create policy academy_periods_update on public.academy_fee_periods for update to authenticated
  using (public.academy_is_finance()) with check (public.academy_is_finance());
-- No INSERT or DELETE policy: periods are created only by academy_create_fee_period().

-- 4. Workflow guard -----------------------------------------------------------------------------------------------
create or replace function public.academy_period_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare reported_changed boolean; checked_changed boolean; approved_changed boolean;
begin
  if (new.guardian_id, new.period_start, new.period_end, new.course_count, new.amount_due, new.currency_code, new.created_by_staff_id, new.created_at)
     is distinct from (old.guardian_id, old.period_start, old.period_end, old.course_count, old.amount_due, old.currency_code, old.created_by_staff_id, old.created_at) then
    raise exception 'Period details cannot be changed';
  end if;
  reported_changed := (new.reported_status, new.paid_on, new.paid_method, new.paid_note)
                      is distinct from (old.reported_status, old.paid_on, old.paid_method, old.paid_note);
  checked_changed := (new.checked_status) is distinct from (old.checked_status);
  approved_changed := (new.approved_status) is distinct from (old.approved_status);

  if reported_changed then
    new.reported_by_staff_id := public.academy_staff_id(); new.reported_at := now();
    new.checked_status := 'unpaid'; new.checked_by_staff_id := null; new.checked_at := null;
    new.approved_status := 'unpaid'; new.approved_by_staff_id := null; new.approved_at := null;
    return new;
  end if;
  if checked_changed then
    if not public.academy_is_finance() then raise exception 'Only finance or an administrator can check a payment'; end if;
    if new.checked_status not in (new.reported_status, 'unpaid') then raise exception 'Check only what was reported (or reset to unpaid)'; end if;
    new.checked_by_staff_id := public.academy_staff_id(); new.checked_at := now();
    new.approved_status := 'unpaid'; new.approved_by_staff_id := null; new.approved_at := null;
    return new;
  end if;
  if approved_changed then
    if not public.academy_is_admin() then raise exception 'Only an administrator can approve a payment'; end if;
    if new.approved_status not in (new.checked_status, 'unpaid') then raise exception 'Approve only what finance checked (or reset to unpaid)'; end if;
    new.approved_by_staff_id := public.academy_staff_id(); new.approved_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.academy_period_guard() from public, anon, authenticated;
drop trigger if exists academy_period_guard_trg on public.academy_fee_periods;
create trigger academy_period_guard_trg before update on public.academy_fee_periods
  for each row execute function public.academy_period_guard();
drop trigger if exists academy_audit_periods on public.academy_fee_periods;
create trigger academy_audit_periods after insert or update on public.academy_fee_periods
  for each row execute function public.academy_audit();

-- 5. Status helpers and view --------------------------------------------------------------------------------------
-- Effective status = approved status; Overdue = not approved as paid and the period has ended (UTC).
create or replace function public.academy_period_state(p_approved text, p_end date) returns text
language sql stable set search_path = '' as $$
  select case when p_approved = 'paid' then 'paid'
              when p_end <= (now() at time zone 'utc')::date then 'overdue'
              else p_approved end $$;
create or replace function public.academy_period_stage(p_reported text, p_checked_at timestamptz, p_approved_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case when p_approved_at is not null then 'approved' when p_checked_at is not null then 'checked'
              when p_reported <> 'unpaid' then 'reported' else 'none' end $$;
grant execute on function public.academy_period_state(text, date), public.academy_period_stage(text, timestamptz, timestamptz) to authenticated;

drop view if exists public.academy_fee_status;
drop view if exists public.academy_fee_period_status;
create view public.academy_fee_period_status with (security_invoker = true) as
select p.id, p.guardian_id, p.period_start, p.period_end, p.course_count, p.amount_due, p.currency_code,
       p.reported_status, p.paid_on, p.paid_method, p.paid_note, p.checked_status, p.approved_status,
       public.academy_period_state(p.approved_status, p.period_end) as status,
       public.academy_period_stage(p.reported_status, p.checked_at, p.approved_at) as stage,
       p.reported_at, p.checked_at, p.approved_at
from public.academy_fee_periods p;
revoke all on public.academy_fee_period_status from anon, authenticated;
grant select on public.academy_fee_period_status to authenticated;

-- 6. Family fee (the owner's rule), computed on the server ---------------------------------------------------------
-- Courses are counted per child (a child in two classes of one course counts once); only active children linked to the
-- guardian by an ADMIN-VERIFIED link count.
create or replace function public.academy_family_fee(p_guardian uuid)
returns table (course_count integer, amount_due numeric)
language plpgsql stable security definer set search_path = '' as $$
declare n integer;
begin
  if not public.academy_is_finance() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select count(*) into n from (
    select distinct e.learner_id, c.course_id
    from public.academy_guardian_links l
    join public.academy_learners le on le.id = l.learner_id and le.active
    join public.academy_enrollments e on e.learner_id = l.learner_id
    join public.academy_classes c on c.id = e.class_id
    where l.guardian_id = p_guardian and l.verified_by_staff_id is not null) t;
  course_count := n;
  amount_due := case when n = 0 then 0 when n = 1 then 150 else 100 * n end;
  return next;
end $$;
revoke execute on function public.academy_family_fee(uuid) from public, anon;
grant execute on function public.academy_family_fee(uuid) to authenticated;

create or replace function public.academy_create_fee_period(p_guardian uuid, p_start date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fee record; v_id uuid; v_end date;
begin
  if not public.academy_is_finance() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_start is null or p_start < date '2020-01-01' or p_start > (now() at time zone 'utc')::date + 365 then raise exception 'Choose a valid start date'; end if;
  v_end := (p_start + interval '3 months')::date;
  select * into fee from public.academy_family_fee(p_guardian);
  if fee.course_count < 1 then raise exception 'This parent has no enrolled courses with a verified child link'; end if;
  if exists (select 1 from public.academy_fee_periods x where x.guardian_id = p_guardian and p_start < x.period_end and v_end > x.period_start)
    then raise exception 'This parent already has a period covering those dates'; end if;
  insert into public.academy_fee_periods(guardian_id, period_start, period_end, course_count, amount_due, created_by_staff_id)
  values (p_guardian, p_start, v_end, fee.course_count, fee.amount_due, public.academy_staff_id()) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.academy_create_fee_period(uuid, date) from public, anon;
grant execute on function public.academy_create_fee_period(uuid, date) to authenticated;

-- 7. Reporting a payment: finance/admin, or a teacher of any of that parent's children ---------------------------
create or replace function public.academy_report_payment(p_period uuid, p_status text, p_paid_on date, p_method text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare per record; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into per from public.academy_fee_periods where id = p_period;
  if per.id is null then raise exception 'Payment period not found'; end if;
  if not (public.academy_is_finance() or exists (
      select 1 from public.academy_guardian_links l
      where l.guardian_id = per.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id))) then
    raise exception 'Not allowed to report a payment for this parent' using errcode = '42501';
  end if;
  if p_status not in ('unpaid','partial','paid') then raise exception 'Choose unpaid, partly paid or paid'; end if;
  if v_note is not null and (char_length(v_note) > 120 or v_note ~ '[<>]') then raise exception 'Note: up to 120 characters, no < or >'; end if;
  if p_status = 'unpaid' then
    update public.academy_fee_periods set reported_status = 'unpaid', paid_on = null, paid_method = null, paid_note = v_note where id = p_period;
    return;
  end if;
  if p_paid_on is null then raise exception 'Enter the date the parent paid'; end if;
  if p_paid_on > (now() at time zone 'utc')::date then raise exception 'The payment date cannot be in the future'; end if;
  if p_paid_on < per.period_start - 31 then raise exception 'The payment date is too far before this period'; end if;
  if p_method is null or p_method not in ('cash','bank','mobile_money','other') then raise exception 'Choose how the parent paid'; end if;
  update public.academy_fee_periods set reported_status = p_status, paid_on = p_paid_on, paid_method = p_method, paid_note = v_note where id = p_period;
end $$;
revoke execute on function public.academy_report_payment(uuid, text, date, text, text) from public, anon;
grant execute on function public.academy_report_payment(uuid, text, date, text, text) to authenticated;

-- 8. Teacher view: parents of the teacher's own students, same record every teacher sees --------------------------
create or replace function public.academy_teacher_fee_periods()
returns table (period_id uuid, guardian_id uuid, guardian_name text, guardian_phone text, period_start date, period_end date,
               amount_due numeric, status text, stage text, reported_status text, paid_on date, paid_method text, paid_note text,
               students text[], courses text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.guardian_id, g.display_name, g.phone_e164, p.period_start, p.period_end, p.amount_due,
         public.academy_period_state(p.approved_status, p.period_end),
         public.academy_period_stage(p.reported_status, p.checked_at, p.approved_at),
         p.reported_status, p.paid_on, p.paid_method, p.paid_note,
         (select coalesce(array_agg(distinct le.display_name order by le.display_name), '{}') from public.academy_guardian_links l
            join public.academy_learners le on le.id = l.learner_id
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)),
         (select coalesce(array_agg(distinct co.title order by co.title), '{}') from public.academy_guardian_links l
            join public.academy_enrollments e on e.learner_id = l.learner_id
            join public.academy_classes c on c.id = e.class_id and c.teacher_staff_id = public.academy_staff_id()
            join public.academy_courses co on co.id = c.course_id
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null)
  from public.academy_fee_periods p join public.academy_guardians g on g.id = p.guardian_id
  where public.academy_staff_role() in ('admin', 'teacher')
    and (public.academy_is_admin() or exists (
      select 1 from public.academy_guardian_links l
      where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)))
  order by p.period_start desc $$;
revoke execute on function public.academy_teacher_fee_periods() from public, anon;
grant execute on function public.academy_teacher_fee_periods() to authenticated;

-- 9. Guardian contacts for students a staff member may manage -----------------------------------------------------
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
    where (v_phone is not null and g.phone_e164 = v_phone) or (v_email is not null and lower(g.email) = v_email) order by (g.phone_e164 = v_phone) desc nulls last limit 1;
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
-- Then re-run supabase/checks/verify_academy_readonly.sql (expect 14+1 tables) and test with separate admin, finance and teacher TEST accounts.
