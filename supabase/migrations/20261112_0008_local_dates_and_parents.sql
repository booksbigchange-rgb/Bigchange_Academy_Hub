-- BigChange Academy — review fixes of 2026-11-10 (migration 0008). Run after 0001–0007. Safe to re-run.
--  1. "Today" is the date in Israel (Asia/Jerusalem), not UTC. Before this, for the first hours after midnight a payment
--     dated today was refused as "in the future", and Overdue changed hours late.
--  2. Family-wide periods are retired. Every new period belongs to one child (migration 0006), so a child can no
--     longer be counted in a family period and in their own period. Existing family-wide periods stay as they are.
--  3. Every verified parent of a child sees that child's periods under Payments, not only the parent the period is
--     stored on. Parents still cannot change anything.
begin;

-- 1. One definition of "today" ------------------------------------------------------------------------------------
create or replace function public.academy_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;
revoke execute on function public.academy_today() from public, anon;
grant execute on function public.academy_today() to authenticated;

create or replace function public.academy_period_state(p_approved text, p_end date) returns text
language sql stable set search_path = '' as $$
  select case when p_approved = 'paid' then 'paid'
              when p_end + 14 <= public.academy_today() then 'overdue'
              else p_approved end $$;

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
  if p_paid_on > public.academy_today() then raise exception 'The payment date cannot be in the future'; end if;
  if p_paid_on < per.period_start - 31 then raise exception 'The payment date is too far before this period'; end if;
  if p_method is null or p_method not in ('cash','bank','mobile_money','other') then raise exception 'Choose how the parent paid'; end if;
  update public.academy_fee_periods set reported_status = p_status, paid_on = p_paid_on, paid_method = p_method, paid_note = v_note where id = p_period;
end $$;
revoke execute on function public.academy_report_payment(uuid, text, date, text, text) from public, anon;
grant execute on function public.academy_report_payment(uuid, text, date, text, text) to authenticated;

create or replace function public.academy_create_child_period(p_learner uuid, p_start date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fee record; v_id uuid; v_end date;
begin
  if not public.academy_is_finance() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_start is null or p_start < date '2020-01-01' or p_start > public.academy_today() + 365 then raise exception 'Choose a valid start date'; end if;
  v_end := (p_start + interval '3 months')::date;
  select * into fee from public.academy_child_fee(p_learner);
  if fee.child_courses < 1 then raise exception 'This child is not enrolled in any class yet'; end if;
  if exists (select 1 from public.academy_fee_periods x where x.learner_id = p_learner and p_start < x.period_end and v_end > x.period_start)
    then raise exception 'This child already has a period covering those dates'; end if;
  insert into public.academy_fee_periods(guardian_id, learner_id, period_start, period_end, course_count, amount_due, created_by_staff_id)
  values (fee.guardian_id, p_learner, p_start, v_end, fee.child_courses, fee.amount_due, public.academy_staff_id()) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.academy_create_child_period(uuid, date) from public, anon;
grant execute on function public.academy_create_child_period(uuid, date) to authenticated;

-- 2. Family-wide periods are retired -------------------------------------------------------------------------------
create or replace function public.academy_create_fee_period(p_guardian uuid, p_start date)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Family-wide periods are no longer used. Start a period for each child instead.';
end $$;
revoke execute on function public.academy_create_fee_period(uuid, date) from public, anon;
grant execute on function public.academy_create_fee_period(uuid, date) to authenticated;

-- 3. Every verified parent of a child sees that child's periods ----------------------------------------------------
drop policy if exists academy_periods_select on public.academy_fee_periods;
create policy academy_periods_select on public.academy_fee_periods for select to authenticated
  using (public.academy_is_finance()
      or exists (select 1 from public.academy_guardians g
                 where g.id = guardian_id and g.auth_user_id = (select auth.uid()))
      or (learner_id is not null and exists (
                 select 1 from public.academy_guardian_links l
                 join public.academy_guardians g on g.id = l.guardian_id
                 where l.learner_id = academy_fee_periods.learner_id and l.verified_by_staff_id is not null
                   and g.auth_user_id = (select auth.uid()))));

commit;
