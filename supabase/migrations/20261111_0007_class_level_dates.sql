-- BigChange Academy — class level dates (migration 0007). Run after 0001–0006. Safe to re-run.
-- Each class can store the start and end date of its current level (3 months for English/Tigrinya/Maths, about 6 for
-- computer stages). The app reminds teachers when a level is about to end, writes the notice (one-week break, next
-- level), and can move the class to the next level (new name and dates; the same students stay enrolled).
-- The admin or the class's own teacher may set these; nobody else.
begin;

alter table public.academy_classes add column if not exists level_start date;
alter table public.academy_classes add column if not exists level_end date;
alter table public.academy_classes drop constraint if exists academy_classes_level_dates_check;
alter table public.academy_classes add constraint academy_classes_level_dates_check
  check ((level_start is null and level_end is null)
      or (level_start is not null and level_end is not null and level_end > level_start and level_end - level_start <= 400));

create or replace function public.academy_set_class_level(p_class uuid, p_title text, p_start date, p_end date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')); old record;
begin
  if not (public.academy_is_admin() or public.academy_teaches_class(p_class)) then
    raise exception 'Not allowed to change this class' using errcode = '42501';
  end if;
  select * into old from public.academy_classes where id = p_class;
  if old.id is null then raise exception 'Class not found'; end if;
  if char_length(v_title) < 2 or char_length(v_title) > 80 or v_title ~ '[<>]' then raise exception 'Enter a class name (2 to 80 characters)'; end if;
  if (p_start is null) <> (p_end is null) then raise exception 'Enter both the start and the end date'; end if;
  if p_start is not null then
    if p_end <= p_start then raise exception 'The level must end after it starts'; end if;
    if p_end - p_start > 400 then raise exception 'A level can be at most about 13 months long'; end if;
    if p_start < date '2020-01-01' or p_end > date '2100-01-01' then raise exception 'Choose dates between 2020 and 2100'; end if;
  end if;
  update public.academy_classes set title = v_title, level_start = p_start, level_end = p_end where id = p_class;
  insert into public.academy_audit_events(actor_id, action, entity_type, entity_id, detail)
  values ((select auth.uid()), 'SET_CLASS_LEVEL', 'academy_classes', p_class::text,
          jsonb_build_object('from', jsonb_build_object('title', old.title, 'start', old.level_start, 'end', old.level_end),
                             'to', jsonb_build_object('title', v_title, 'start', p_start, 'end', p_end)));
end $$;
revoke execute on function public.academy_set_class_level(uuid, text, date, date) from public, anon;
grant execute on function public.academy_set_class_level(uuid, text, date, date) to authenticated;

commit;
-- Then re-run supabase/checks/verify_academy_readonly.sql: still 16 tables and 43 policies.
