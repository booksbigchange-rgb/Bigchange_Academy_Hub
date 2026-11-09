-- BigChange Academy — owner decisions of 2026-11-10 (migration 0006). Run after 0001–0005. Safe to re-run.
--  * Each child can have their OWN 3 months, starting the day that child starts (e.g. a sister joining mid-way).
--    Fee for a child's period = that child's courses × (USD 150 if the family has one course in total, else USD 100).
--  * An admin can change the amount of any period, with a reason; the change is audited.
--  * Reminders can also be recorded as sent by email (a staff member's own email app, BCC).
--  * Recording one permission (e.g. WhatsApp) no longer clears the other (email).
-- Family-wide periods created before this migration keep working unchanged.
begin;

-- 1. Optional child on a period ---------------------------------------------------------------------------------
alter table public.academy_fee_periods add column if not exists learner_id uuid references public.academy_learners(id);
alter table public.academy_fee_periods drop constraint if exists academy_fee_periods_guardian_id_period_start_key;
create unique index if not exists academy_fee_periods_family_start_uq on public.academy_fee_periods (guardian_id, period_start) where learner_id is null;
create unique index if not exists academy_fee_periods_child_start_uq on public.academy_fee_periods (learner_id, period_start) where learner_id is not null;

-- 2. Guard: amounts may change only through academy_set_period_amount (admin) --------------------------------------
create or replace function public.academy_period_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare reported_changed boolean; checked_changed boolean; approved_changed boolean;
        amount_ok boolean := coalesce(current_setting('academy.amount_change', true), '') = 'on' and public.academy_is_admin();
begin
  if (new.guardian_id, new.learner_id, new.period_start, new.period_end, new.course_count, new.currency_code, new.created_by_staff_id, new.created_at)
     is distinct from (old.guardian_id, old.learner_id, old.period_start, old.period_end, old.course_count, old.currency_code, old.created_by_staff_id, old.created_at)
     or (new.amount_due is distinct from old.amount_due and not amount_ok) then
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

create or replace function public.academy_set_period_amount(p_period uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_reason text := btrim(coalesce(p_reason, '')); old_amount numeric;
begin
  if not public.academy_is_admin() then raise exception 'Only an administrator can change an amount' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'Enter an amount between 1 and 100000'; end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 or v_reason ~ '[<>]' then raise exception 'Enter a reason (3 to 200 characters)'; end if;
  select amount_due into old_amount from public.academy_fee_periods where id = p_period;
  if old_amount is null then raise exception 'Payment period not found'; end if;
  perform set_config('academy.amount_change', 'on', true);
  update public.academy_fee_periods set amount_due = round(p_amount, 2) where id = p_period;
  perform set_config('academy.amount_change', 'off', true);
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), 'CHANGE_AMOUNT', 'academy_fee_periods', p_period::text,
          jsonb_build_object('from', old_amount, 'to', round(p_amount, 2), 'reason', v_reason));
end $$;
revoke execute on function public.academy_set_period_amount(uuid, numeric, text) from public, anon;
grant execute on function public.academy_set_period_amount(uuid, numeric, text) to authenticated;

-- 3. A child's own period ------------------------------------------------------------------------------------------
create or replace function public.academy_child_fee(p_learner uuid)
returns table (guardian_id uuid, child_courses integer, family_courses integer, amount_due numeric)
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; c integer; f integer;
begin
  if not public.academy_is_finance() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select l.guardian_id into g from public.academy_guardian_links l
    join public.academy_learners le on le.id = l.learner_id and le.active
    where l.learner_id = p_learner and l.verified_by_staff_id is not null order by l.guardian_id limit 1;
  if g is null then raise exception 'This child has no verified parent'; end if;
  select count(distinct c2.course_id) into c from public.academy_enrollments e
    join public.academy_classes c2 on c2.id = e.class_id where e.learner_id = p_learner;
  select fee.course_count into f from public.academy_family_fee(g) fee;
  guardian_id := g; child_courses := c; family_courses := f;
  amount_due := case when c = 0 then 0 when f = 1 then 150 else 100 * c end;
  return next;
end $$;
revoke execute on function public.academy_child_fee(uuid) from public, anon;
grant execute on function public.academy_child_fee(uuid) to authenticated;

create or replace function public.academy_create_child_period(p_learner uuid, p_start date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fee record; v_id uuid; v_end date;
begin
  if not public.academy_is_finance() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_start is null or p_start < date '2020-01-01' or p_start > (now() at time zone 'utc')::date + 365 then raise exception 'Choose a valid start date'; end if;
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

-- 4. Views include the child -------------------------------------------------------------------------------------
drop view if exists public.academy_fee_period_status;
create view public.academy_fee_period_status with (security_invoker = true) as
select p.id, p.guardian_id, p.learner_id, p.period_start, p.period_end, p.course_count, p.amount_due, p.currency_code,
       p.reported_status, p.paid_on, p.paid_method, p.paid_note, p.checked_status, p.approved_status,
       public.academy_period_state(p.approved_status, p.period_end) as status,
       public.academy_period_stage(p.reported_status, p.checked_at, p.approved_at) as stage,
       p.reported_at, p.checked_at, p.approved_at
from public.academy_fee_periods p;
revoke all on public.academy_fee_period_status from anon, authenticated;
grant select on public.academy_fee_period_status to authenticated;

drop function if exists public.academy_teacher_fee_periods();
create function public.academy_teacher_fee_periods()
returns table (period_id uuid, guardian_id uuid, guardian_name text, guardian_phone text, period_start date, period_end date,
               amount_due numeric, status text, stage text, reported_status text, paid_on date, paid_method text, paid_note text,
               students text[], courses text[], whatsapp_opt_in boolean, last_reminded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.guardian_id, g.display_name, g.phone_e164, p.period_start, p.period_end, p.amount_due,
         public.academy_period_state(p.approved_status, p.period_end),
         public.academy_period_stage(p.reported_status, p.checked_at, p.approved_at),
         p.reported_status, p.paid_on, p.paid_method, p.paid_note,
         (select coalesce(array_agg(distinct le.display_name order by le.display_name), '{}') from public.academy_guardian_links l
            join public.academy_learners le on le.id = l.learner_id
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)
              and (p.learner_id is null or le.id = p.learner_id)),
         (select coalesce(array_agg(distinct co.title order by co.title), '{}') from public.academy_guardian_links l
            join public.academy_enrollments e on e.learner_id = l.learner_id
            join public.academy_classes c on c.id = e.class_id and c.teacher_staff_id = public.academy_staff_id()
            join public.academy_courses co on co.id = c.course_id
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null
              and (p.learner_id is null or l.learner_id = p.learner_id)),
         g.whatsapp_opt_in,
         (select max(r.sent_at) from public.academy_reminder_events r where r.period_id = p.id)
  from public.academy_fee_periods p join public.academy_guardians g on g.id = p.guardian_id
  where public.academy_staff_role() in ('admin', 'teacher')
    and (public.academy_is_admin() or exists (
      select 1 from public.academy_guardian_links l
      where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)))
  order by p.period_start desc, p.id $$;
revoke execute on function public.academy_teacher_fee_periods() from public, anon;
grant execute on function public.academy_teacher_fee_periods() to authenticated;

-- 5. Email reminders (sent from staff's own email app) ------------------------------------------------------------
alter table public.academy_reminder_events drop constraint if exists academy_reminder_events_channel_check;
alter table public.academy_reminder_events add constraint academy_reminder_events_channel_check check (channel in ('whatsapp', 'copied', 'email'));
create or replace function public.academy_log_reminder(p_period uuid, p_channel text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare per record; g record; v_at timestamptz;
begin
  select * into per from public.academy_fee_periods where id = p_period;
  if per.id is null then raise exception 'Payment period not found'; end if;
  if not public.academy_may_contact_guardian(per.guardian_id) then
    raise exception 'Not allowed to remind this parent' using errcode = '42501';
  end if;
  if p_channel not in ('whatsapp', 'copied', 'email') then raise exception 'Unknown reminder channel'; end if;
  select * into g from public.academy_guardians where id = per.guardian_id;
  if p_channel = 'whatsapp' and not (g.whatsapp_opt_in and g.phone_e164 is not null) then
    raise exception 'This parent has not agreed to WhatsApp messages';
  end if;
  if p_channel = 'email' and not (g.email_opt_in and g.email is not null) then
    raise exception 'This parent has not agreed to email';
  end if;
  insert into public.academy_reminder_events(period_id, guardian_id, staff_id, channel)
  values (p_period, per.guardian_id, public.academy_staff_id(), p_channel) returning sent_at into v_at;
  return v_at;
end $$;

-- 6. Permission changes: NULL means "leave as it is" (so recording WhatsApp permission never clears email permission)
create or replace function public.academy_set_guardian_consent(p_guardian uuid, p_email_opt boolean, p_whatsapp_opt boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g record; v_email boolean; v_wa boolean;
begin
  if not (public.academy_is_admin() or (public.academy_staff_role() = 'teacher' and public.academy_may_contact_guardian(p_guardian))) then
    raise exception 'Not allowed to change this parent''s permissions' using errcode = '42501';
  end if;
  select * into g from public.academy_guardians where id = p_guardian;
  if g.id is null then raise exception 'Parent not found'; end if;
  v_email := coalesce(p_email_opt, g.email_opt_in);
  v_wa := coalesce(p_whatsapp_opt, g.whatsapp_opt_in);
  if v_wa and g.phone_e164 is null then raise exception 'Add a phone number before recording WhatsApp permission'; end if;
  if v_email and g.email is null then raise exception 'Add an email address before recording email permission'; end if;
  update public.academy_guardians set email_opt_in = v_email, whatsapp_opt_in = v_wa where id = p_guardian;
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), 'SET_CONSENT', 'academy_guardians', p_guardian::text, jsonb_build_object('email', v_email, 'whatsapp', v_wa));
end $$;

commit;
-- Then re-run supabase/checks/verify_academy_readonly.sql: still 16 tables and 43 policies.
