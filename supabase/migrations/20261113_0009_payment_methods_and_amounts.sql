-- BigChange Academy — payment methods and amounts (migration 0009). Run after 0001–0008. Safe to re-run.
--  * The school's real payment channels replace cash/bank/mobile money. The admin can add, rename or switch off options.
--  * A payment report can include the amount the parent said they paid (USD, optional).
-- Internal staff tool: parents still pay outside the app; nothing here moves money.
begin;

-- 1. Payment methods the admin manages ---------------------------------------------------------------------------
create table if not exists public.academy_payment_methods (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (char_length(label) between 2 and 60 and label !~ '[<>]'),
  active boolean not null default true,
  sort_order integer not null default 100
);
insert into public.academy_payment_methods(code, label, active, sort_order) values
  ('israel', 'Israel', true, 10),
  ('website', 'Big Change – Website', true, 20),
  ('ria_tsegay', 'Ria – Tsegay', true, 30),
  ('remitly_tsegay', 'Remitly – Tsegay', true, 40),
  ('teacher_essey', 'Teacher Essey Lueul', true, 50),
  ('habesha_shop', 'Habesha shop', true, 60),
  ('finance_team', 'Finance team', true, 70),
  ('other', 'Other', true, 90),
  ('cash', 'Cash (old)', false, 200),
  ('bank', 'Bank (old)', false, 210),
  ('mobile_money', 'Mobile money (old)', false, 220)
on conflict (code) do nothing;
alter table public.academy_payment_methods enable row level security;
alter table public.academy_payment_methods force row level security;
revoke all on public.academy_payment_methods from anon, authenticated;
grant select, insert, update on public.academy_payment_methods to authenticated;
drop policy if exists academy_methods_select on public.academy_payment_methods;
create policy academy_methods_select on public.academy_payment_methods for select to authenticated
  using (public.academy_staff_id() is not null);
drop policy if exists academy_methods_insert on public.academy_payment_methods;
create policy academy_methods_insert on public.academy_payment_methods for insert to authenticated
  with check (public.academy_is_admin());
drop policy if exists academy_methods_update on public.academy_payment_methods;
create policy academy_methods_update on public.academy_payment_methods for update to authenticated
  using (public.academy_is_admin()) with check (public.academy_is_admin());
-- No DELETE: switch an option off instead, so old reports keep their label.

alter table public.academy_fee_periods drop constraint if exists academy_fee_periods_paid_method_check;
alter table public.academy_fee_periods drop constraint if exists academy_fee_periods_paid_method_fk;
alter table public.academy_fee_periods add constraint academy_fee_periods_paid_method_fk
  foreign key (paid_method) references public.academy_payment_methods(code);

-- 2. Optional amount on a report -----------------------------------------------------------------------------------
alter table public.academy_fee_periods add column if not exists paid_amount numeric(12,2)
  check (paid_amount is null or (paid_amount > 0 and paid_amount <= 100000));

-- Guard: the amount belongs to the report, so changing it sends the report back for checking.
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
  reported_changed := (new.reported_status, new.paid_on, new.paid_method, new.paid_note, new.paid_amount)
                      is distinct from (old.reported_status, old.paid_on, old.paid_method, old.paid_note, old.paid_amount);
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

-- 3. Reporting: method from the admin's list, optional amount ---------------------------------------------------------
drop function if exists public.academy_report_payment(uuid, text, date, text, text);
create or replace function public.academy_report_payment(p_period uuid, p_status text, p_paid_on date, p_method text, p_note text, p_amount numeric)
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
    update public.academy_fee_periods set reported_status = 'unpaid', paid_on = null, paid_method = null, paid_note = v_note, paid_amount = null where id = p_period;
    return;
  end if;
  if p_paid_on is null then raise exception 'Enter the date the parent paid'; end if;
  if p_paid_on > public.academy_today() then raise exception 'The payment date cannot be in the future'; end if;
  if p_paid_on < per.period_start - 31 then raise exception 'The payment date is too far before this period'; end if;
  if p_method is null or not exists (select 1 from public.academy_payment_methods m where m.code = p_method and m.active) then
    raise exception 'Choose how the parent paid';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount > 100000) then raise exception 'Enter an amount between 1 and 100000, or leave it empty'; end if;
  update public.academy_fee_periods set reported_status = p_status, paid_on = p_paid_on, paid_method = p_method, paid_note = v_note,
    paid_amount = round(p_amount, 2) where id = p_period;
end $$;
revoke execute on function public.academy_report_payment(uuid, text, date, text, text, numeric) from public, anon;
grant execute on function public.academy_report_payment(uuid, text, date, text, text, numeric) to authenticated;

-- 4. Views include the amount ----------------------------------------------------------------------------------------
drop view if exists public.academy_fee_period_status;
create view public.academy_fee_period_status with (security_invoker = true) as
select p.id, p.guardian_id, p.learner_id, p.period_start, p.period_end, p.course_count, p.amount_due, p.currency_code,
       p.reported_status, p.paid_on, p.paid_method, p.paid_note, p.paid_amount, p.checked_status, p.approved_status,
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
               students text[], courses text[], whatsapp_opt_in boolean, last_reminded_at timestamptz, paid_amount numeric)
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
         (select max(r.sent_at) from public.academy_reminder_events r where r.period_id = p.id),
         p.paid_amount
  from public.academy_fee_periods p join public.academy_guardians g on g.id = p.guardian_id
  where public.academy_staff_role() in ('admin', 'teacher')
    and (public.academy_is_admin() or exists (
      select 1 from public.academy_guardian_links l
      where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)))
  order by p.period_start desc, p.id $$;
revoke execute on function public.academy_teacher_fee_periods() from public, anon;
grant execute on function public.academy_teacher_fee_periods() to authenticated;

commit;
-- Then re-run supabase/checks/verify_academy_readonly.sql: expect 17 tables and 46 policies.
