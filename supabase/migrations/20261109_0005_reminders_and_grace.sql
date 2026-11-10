-- BigChange Academy — owner decisions of 2026-11-09 (migration 0005). Run after 0001–0004. Safe to re-run.
--  Q1: a family is Overdue only 14 days AFTER their 3-month period ends without an approved payment.
--  Q4: "Send on WhatsApp" reminders by teachers (for parents of their own students) and by finance/admin; the date of
--      each reminder is recorded. WhatsApp reminders are refused by the database unless the parent agreed to WhatsApp.
--  Consent can now be recorded or withdrawn for a parent already on file (admin, or a teacher of one of their children).
begin;

-- 1. Overdue after a 14-day grace period ------------------------------------------------------------------------
create or replace function public.academy_period_state(p_approved text, p_end date) returns text
language sql stable set search_path = '' as $$
  select case when p_approved = 'paid' then 'paid'
              when p_end + 14 <= (now() at time zone 'utc')::date then 'overdue'
              else p_approved end $$;

-- 2. Consent must match the contact details -------------------------------------------------------------------
update public.academy_guardians set whatsapp_opt_in = false where whatsapp_opt_in and phone_e164 is null;
update public.academy_guardians set email_opt_in = false where email_opt_in and email is null;
alter table public.academy_guardians drop constraint if exists academy_guardian_whatsapp_needs_phone;
alter table public.academy_guardians add constraint academy_guardian_whatsapp_needs_phone check (not whatsapp_opt_in or phone_e164 is not null);
alter table public.academy_guardians drop constraint if exists academy_guardian_email_needs_email;
alter table public.academy_guardians add constraint academy_guardian_email_needs_email check (not email_opt_in or email is not null);

-- Who may act for a parent: admin/finance, or a teacher of one of the parent's verified children.
create or replace function public.academy_may_contact_guardian(p_guardian uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.academy_is_finance() or exists (
    select 1 from public.academy_guardian_links l
    where l.guardian_id = p_guardian and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)) $$;
revoke execute on function public.academy_may_contact_guardian(uuid) from public, anon;
grant execute on function public.academy_may_contact_guardian(uuid) to authenticated;

create or replace function public.academy_set_guardian_consent(p_guardian uuid, p_email_opt boolean, p_whatsapp_opt boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g record;
begin
  if not (public.academy_is_admin() or (public.academy_staff_role() = 'teacher' and public.academy_may_contact_guardian(p_guardian))) then
    raise exception 'Not allowed to change this parent''s permissions' using errcode = '42501';
  end if;
  select * into g from public.academy_guardians where id = p_guardian;
  if g.id is null then raise exception 'Parent not found'; end if;
  if coalesce(p_whatsapp_opt, false) and g.phone_e164 is null then raise exception 'Add a phone number before recording WhatsApp permission'; end if;
  if coalesce(p_email_opt, false) and g.email is null then raise exception 'Add an email address before recording email permission'; end if;
  update public.academy_guardians set email_opt_in = coalesce(p_email_opt, false), whatsapp_opt_in = coalesce(p_whatsapp_opt, false) where id = p_guardian;
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), 'SET_CONSENT', 'academy_guardians', p_guardian::text,
          jsonb_build_object('email', coalesce(p_email_opt, false), 'whatsapp', coalesce(p_whatsapp_opt, false)));
end $$;
revoke execute on function public.academy_set_guardian_consent(uuid, boolean, boolean) from public, anon;
grant execute on function public.academy_set_guardian_consent(uuid, boolean, boolean) to authenticated;

-- 3. Reminder log -------------------------------------------------------------------------------------------------
create table if not exists public.academy_reminder_events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.academy_fee_periods(id),
  guardian_id uuid not null references public.academy_guardians(id),
  staff_id uuid not null references public.academy_staff(id),
  channel text not null check (channel in ('whatsapp', 'copied')),
  sent_at timestamptz not null default now()
);
create index if not exists academy_reminder_events_period_idx on public.academy_reminder_events (period_id, sent_at desc);
alter table public.academy_reminder_events enable row level security;
alter table public.academy_reminder_events force row level security;
revoke all on public.academy_reminder_events from anon, authenticated;
grant select on public.academy_reminder_events to authenticated;
drop policy if exists academy_reminders_select on public.academy_reminder_events;
create policy academy_reminders_select on public.academy_reminder_events for select to authenticated
  using (public.academy_is_finance());
-- No INSERT/UPDATE/DELETE policies: rows are written only by academy_log_reminder().

create or replace function public.academy_log_reminder(p_period uuid, p_channel text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare per record; g record; v_at timestamptz;
begin
  select * into per from public.academy_fee_periods where id = p_period;
  if per.id is null then raise exception 'Payment period not found'; end if;
  if not public.academy_may_contact_guardian(per.guardian_id) then
    raise exception 'Not allowed to remind this parent' using errcode = '42501';
  end if;
  if p_channel not in ('whatsapp', 'copied') then raise exception 'Unknown reminder channel'; end if;
  select * into g from public.academy_guardians where id = per.guardian_id;
  if p_channel = 'whatsapp' and not (g.whatsapp_opt_in and g.phone_e164 is not null) then
    raise exception 'This parent has not agreed to WhatsApp messages';
  end if;
  insert into public.academy_reminder_events(period_id, guardian_id, staff_id, channel)
  values (p_period, per.guardian_id, public.academy_staff_id(), p_channel) returning sent_at into v_at;
  return v_at;
end $$;
revoke execute on function public.academy_log_reminder(uuid, text) from public, anon;
grant execute on function public.academy_log_reminder(uuid, text) to authenticated;

-- 4. Teacher view now includes WhatsApp permission and the last reminder date -------------------------------------
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
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null and public.academy_teaches_learner(l.learner_id)),
         (select coalesce(array_agg(distinct co.title order by co.title), '{}') from public.academy_guardian_links l
            join public.academy_enrollments e on e.learner_id = l.learner_id
            join public.academy_classes c on c.id = e.class_id and c.teacher_staff_id = public.academy_staff_id()
            join public.academy_courses co on co.id = c.course_id
            where l.guardian_id = p.guardian_id and l.verified_by_staff_id is not null),
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

commit;
-- Then re-run supabase/checks/verify_academy_readonly.sql: expect 16 tables and 43 policies.
