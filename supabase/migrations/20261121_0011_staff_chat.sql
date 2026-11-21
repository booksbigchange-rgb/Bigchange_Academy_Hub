-- BigChange Academy — migration 0011: staff chat (M6 step 2, docs/M6_PHONE_AND_STAFF_CHAT_PLAN.md).
-- Run in the Academy project's SQL Editor AFTER 0001–0010. Safe to run again.
-- Adds 6 tables and 6 policies (the verify script then expects 23 tables and 52 policies).
--
-- Who can use chat: active staff only (admin, teacher, finance). Parents, students and switched-off staff have no access
-- at all, because every rule goes through academy_staff_id(), which is empty for them (migration 0010).
--
-- Conversations
--  * direct:   two staff members. Started with academy_chat_start_direct(); one conversation per pair.
--  * groups:   made by the database, never by staff. Membership is worked out live from the Hub's data, so it is always
--              right without any syncing:
--                all_staff -> every active staff member
--                teachers  -> active teachers + admins
--                finance   -> active finance + admins
--                class     -> that class's current teacher + admins (a new group appears when a class is created)
--
-- Privacy (owner decision C): conversations are private to their members. Admins are members of every group, but NOT of
-- other people's one-to-one chats. A member can report a message; an admin can then read that conversation only through
-- academy_chat_open_report(), which records every opening in academy_chat_admin_access. A reported message cannot be
-- deleted (so the evidence stays).
--
-- Writing: there are no INSERT/UPDATE/DELETE policies. Every change goes through a function below that checks the rules.
-- Message text is never copied to the audit trail.
begin;

-- 1. Tables ---------------------------------------------------------------------------------------------------------
create table if not exists public.academy_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  group_key text unique check (group_key is null or group_key in ('all_staff', 'teachers', 'finance') or group_key like 'direct:%'),
  class_id uuid unique references public.academy_classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'direct') = (group_key like 'direct:%')),
  check (kind = 'direct' or group_key is not null or class_id is not null)
);

create table if not exists public.academy_chat_members (
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  staff_id uuid not null references public.academy_staff(id),
  primary key (conversation_id, staff_id)
);

create table if not exists public.academy_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  sender_staff_id uuid not null references public.academy_staff(id),
  body text check (body is null or char_length(body) between 1 and 4000),
  link_url text check (link_url is null or (link_url ~ '^https://[^[:space:]]+$' and char_length(link_url) <= 2000)),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (deleted_at is not null or body is not null or link_url is not null)
);
create index if not exists academy_chat_messages_conv_idx on public.academy_chat_messages (conversation_id, created_at desc);

create table if not exists public.academy_chat_reads (
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  staff_id uuid not null references public.academy_staff(id),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, staff_id)
);

create table if not exists public.academy_chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.academy_chat_messages(id) on delete cascade,
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  reporter_staff_id uuid not null references public.academy_staff(id),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by_staff_id uuid references public.academy_staff(id),
  handled_note text check (handled_note is null or char_length(handled_note) <= 500)
);
create unique index if not exists academy_chat_reports_open_once
  on public.academy_chat_reports (message_id, reporter_staff_id) where handled_at is null;

create table if not exists public.academy_chat_admin_access (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.academy_chat_reports(id) on delete cascade,
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  admin_staff_id uuid not null references public.academy_staff(id),
  opened_at timestamptz not null default now()
);

-- 2. Who is in a conversation (live, from the Hub's data) -------------------------------------------------------------
create or replace function public.academy_chat_is_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.academy_staff_id() is not null and exists (
    select 1 from public.academy_chat_conversations c
    where c.id = p_conv and (
         (c.kind = 'direct' and exists (select 1 from public.academy_chat_members m
                                        where m.conversation_id = c.id and m.staff_id = public.academy_staff_id()))
      or c.group_key = 'all_staff'
      or (c.group_key = 'teachers' and public.academy_staff_role() in ('teacher', 'admin'))
      or (c.group_key = 'finance' and public.academy_staff_role() in ('finance', 'admin'))
      or (c.class_id is not null and (public.academy_is_admin() or public.academy_teaches_class(c.class_id))))) $$;

-- Active staff in a conversation (used for the member list now and phone alerts later). Members only.
create or replace function public.academy_chat_participants(p_conv uuid)
returns table(staff_id uuid, display_name text, role text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.academy_chat_conversations%rowtype;
begin
  if not public.academy_chat_is_member(p_conv) then raise exception 'Not a member of this conversation' using errcode = '42501'; end if;
  select * into c from public.academy_chat_conversations where id = p_conv;
  return query
    select s.id, coalesce(s.display_name, 'Staff member'), s.role from public.academy_staff s
    where s.active and (
         (c.kind = 'direct' and exists (select 1 from public.academy_chat_members m where m.conversation_id = c.id and m.staff_id = s.id))
      or c.group_key = 'all_staff'
      or (c.group_key = 'teachers' and s.role in ('teacher', 'admin'))
      or (c.group_key = 'finance' and s.role in ('finance', 'admin'))
      or (c.class_id is not null and (s.role = 'admin' or exists (select 1 from public.academy_classes k where k.id = c.class_id and k.teacher_staff_id = s.id))))
    order by lower(coalesce(s.display_name, '')), s.id;
end $$;

-- 3. Read rules -------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['academy_chat_conversations','academy_chat_members','academy_chat_messages','academy_chat_reads',
                           'academy_chat_reports','academy_chat_admin_access'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists academy_chat_conversations_select on public.academy_chat_conversations;
create policy academy_chat_conversations_select on public.academy_chat_conversations for select to authenticated
  using (public.academy_chat_is_member(id));
drop policy if exists academy_chat_members_select on public.academy_chat_members;
create policy academy_chat_members_select on public.academy_chat_members for select to authenticated
  using (public.academy_chat_is_member(conversation_id));
drop policy if exists academy_chat_messages_select on public.academy_chat_messages;
create policy academy_chat_messages_select on public.academy_chat_messages for select to authenticated
  using (public.academy_chat_is_member(conversation_id));
drop policy if exists academy_chat_reads_select on public.academy_chat_reads;
create policy academy_chat_reads_select on public.academy_chat_reads for select to authenticated
  using (staff_id = public.academy_staff_id());
drop policy if exists academy_chat_reports_select on public.academy_chat_reports;
create policy academy_chat_reports_select on public.academy_chat_reports for select to authenticated
  using (public.academy_is_admin() or reporter_staff_id = public.academy_staff_id());
drop policy if exists academy_chat_admin_access_select on public.academy_chat_admin_access;
create policy academy_chat_admin_access_select on public.academy_chat_admin_access for select to authenticated
  using (public.academy_is_admin());

-- 4. Groups: the three school-wide groups, one per class (now and for every new class) -------------------------------
insert into public.academy_chat_conversations (kind, group_key) values ('group', 'all_staff'), ('group', 'teachers'), ('group', 'finance')
  on conflict (group_key) do nothing;
insert into public.academy_chat_conversations (kind, class_id) select 'group', id from public.academy_classes
  on conflict (class_id) do nothing;

create or replace function public.academy_chat_class_group() returns trigger
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  insert into public.academy_chat_conversations (kind, class_id) values ('group', new.id) on conflict (class_id) do nothing;
  return new;
end $$;
revoke execute on function public.academy_chat_class_group() from public, anon, authenticated;
drop trigger if exists academy_chat_class_group on public.academy_classes;
create trigger academy_chat_class_group after insert on public.academy_classes
  for each row execute function public.academy_chat_class_group();

-- 5. Functions staff use -----------------------------------------------------------------------------------------------
create or replace function public.academy_chat_require_staff() returns uuid
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v uuid := public.academy_staff_id();
begin
  if v is null then raise exception 'Chat is for active staff only' using errcode = '42501'; end if;
  return v;
end $$;

-- Active colleagues to start a one-to-one chat with (any active staff member may see names and roles).
create or replace function public.academy_chat_staff_directory()
returns table(staff_id uuid, display_name text, role text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff();
begin
  return query select s.id, coalesce(s.display_name, 'Staff member'), s.role from public.academy_staff s
    where s.active and s.id <> me order by lower(coalesce(s.display_name, '')), s.id;
end $$;

-- My conversations with title, last message and unread count.
create or replace function public.academy_chat_conversation_list()
returns table(conversation_id uuid, kind text, group_key text, class_id uuid, title text, other_staff_id uuid,
              last_message_at timestamptz, last_sender_name text, last_preview text, unread integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff();
begin
  return query
    with mine as (
      select c.* from public.academy_chat_conversations c where public.academy_chat_is_member(c.id)
    ), other as (
      select m.conversation_id, s.id as sid, coalesce(s.display_name, 'Staff member') as nm
      from public.academy_chat_members m join public.academy_staff s on s.id = m.staff_id
      where m.staff_id <> me and m.conversation_id in (select id from mine where kind = 'direct')
    )
    select c.id, c.kind, c.group_key, c.class_id,
      case when c.kind = 'direct' then coalesce(o.nm, 'Staff member')
           when c.group_key = 'all_staff' then 'All staff'
           when c.group_key = 'teachers' then 'Teachers'
           when c.group_key = 'finance' then 'Finance'
           else coalesce((select k.title from public.academy_classes k where k.id = c.class_id), 'Class') end,
      o.sid, lm.created_at, lm.sender_name,
      case when lm.id is null then null when lm.deleted_at is not null then 'Message deleted'
           else left(coalesce(lm.body, lm.link_url), 120) end,
      (select count(*)::integer from public.academy_chat_messages x
        where x.conversation_id = c.id and x.sender_staff_id <> me and x.deleted_at is null
          and x.created_at > coalesce((select r.last_read_at from public.academy_chat_reads r
                                       where r.conversation_id = c.id and r.staff_id = me), '-infinity'::timestamptz))
    from mine c
    left join other o on o.conversation_id = c.id
    left join lateral (
      select x.id, x.created_at, x.body, x.link_url, x.deleted_at, coalesce(s.display_name, 'Staff member') as sender_name
      from public.academy_chat_messages x join public.academy_staff s on s.id = x.sender_staff_id
      where x.conversation_id = c.id order by x.created_at desc limit 1) lm on true
    order by lm.created_at desc nulls last,
      case c.group_key when 'all_staff' then 1 when 'teachers' then 2 when 'finance' then 3 else 4 end, c.id;
end $$;

create or replace function public.academy_chat_start_direct(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); v_key text; v_id uuid;
begin
  if p_other is null or p_other = me then raise exception 'Choose another staff member'; end if;
  if not exists (select 1 from public.academy_staff where id = p_other and active) then
    raise exception 'That staff member is not active';
  end if;
  v_key := 'direct:' || least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into v_id from public.academy_chat_conversations where group_key = v_key;
  if v_id is null then
    insert into public.academy_chat_conversations (kind, group_key) values ('direct', v_key)
      on conflict (group_key) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.academy_chat_conversations where group_key = v_key; end if;
    insert into public.academy_chat_members (conversation_id, staff_id) values (v_id, me), (v_id, p_other) on conflict do nothing;
  end if;
  return v_id;
end $$;

create or replace function public.academy_chat_send(p_conv uuid, p_body text, p_link text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); v_body text := nullif(btrim(coalesce(p_body, '')), '');
        v_link text := nullif(btrim(coalesce(p_link, '')), ''); v_id uuid;
begin
  if not public.academy_chat_is_member(p_conv) then raise exception 'Not a member of this conversation' using errcode = '42501'; end if;
  if v_body is null and v_link is null then raise exception 'Write a message'; end if;
  if char_length(coalesce(v_body, '')) > 4000 then raise exception 'Message is too long (4,000 characters at most)'; end if;
  if v_link is not null and not (v_link ~ '^https://[^[:space:]]+$' and char_length(v_link) <= 2000) then
    raise exception 'Links must start with https://';
  end if;
  insert into public.academy_chat_messages (conversation_id, sender_staff_id, body, link_url)
  values (p_conv, me, v_body, v_link) returning id into v_id;
  insert into public.academy_chat_reads (conversation_id, staff_id, last_read_at) values (p_conv, me, now())
    on conflict (conversation_id, staff_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end $$;

-- Own message, within 15 minutes, and not if someone reported it.
create or replace function public.academy_chat_delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); m public.academy_chat_messages%rowtype;
begin
  select * into m from public.academy_chat_messages where id = p_message;
  if m.id is null or not public.academy_chat_is_member(m.conversation_id) then raise exception 'Message not found'; end if;
  if m.sender_staff_id <> me then raise exception 'You can delete only your own messages' using errcode = '42501'; end if;
  if m.deleted_at is not null then return; end if;
  if now() - m.created_at > interval '15 minutes' then raise exception 'Messages can be deleted only within 15 minutes'; end if;
  if exists (select 1 from public.academy_chat_reports where message_id = p_message) then
    raise exception 'This message was reported and cannot be deleted';
  end if;
  update public.academy_chat_messages set body = null, link_url = null, deleted_at = now() where id = p_message;
end $$;

create or replace function public.academy_chat_mark_read(p_conv uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff();
begin
  if not public.academy_chat_is_member(p_conv) then raise exception 'Not a member of this conversation' using errcode = '42501'; end if;
  insert into public.academy_chat_reads (conversation_id, staff_id, last_read_at) values (p_conv, me, now())
    on conflict (conversation_id, staff_id) do update set last_read_at = excluded.last_read_at;
end $$;

create or replace function public.academy_chat_report(p_message uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); m public.academy_chat_messages%rowtype;
        v_reason text := btrim(coalesce(p_reason, '')); v_id uuid;
begin
  select * into m from public.academy_chat_messages where id = p_message;
  if m.id is null or not public.academy_chat_is_member(m.conversation_id) then raise exception 'Message not found'; end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then raise exception 'Say briefly why (3 to 500 characters)'; end if;
  if exists (select 1 from public.academy_chat_reports where message_id = p_message and reporter_staff_id = me and handled_at is null) then
    raise exception 'You have already reported this message';
  end if;
  insert into public.academy_chat_reports (message_id, conversation_id, reporter_staff_id, reason)
  values (p_message, m.conversation_id, me, v_reason) returning id into v_id;
  return v_id;
end $$;

-- 6. Admin: reports -------------------------------------------------------------------------------------------------
create or replace function public.academy_chat_report_list()
returns table(report_id uuid, created_at timestamptz, reason text, reporter_name text, sender_name text,
              message_preview text, conversation_id uuid, handled_at timestamptz, handled_note text, times_opened integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.academy_is_admin() then raise exception 'Only an administrator can see reports' using errcode = '42501'; end if;
  return query
    select r.id, r.created_at, r.reason, coalesce(rp.display_name, 'Staff member'), coalesce(sd.display_name, 'Staff member'),
      case when m.deleted_at is not null then 'Message deleted' else left(coalesce(m.body, m.link_url), 200) end,
      r.conversation_id, r.handled_at, r.handled_note,
      (select count(*)::integer from public.academy_chat_admin_access a where a.report_id = r.id)
    from public.academy_chat_reports r
    join public.academy_chat_messages m on m.id = r.message_id
    join public.academy_staff rp on rp.id = r.reporter_staff_id
    join public.academy_staff sd on sd.id = m.sender_staff_id
    order by (r.handled_at is null) desc, r.created_at desc;
end $$;

-- The only way for an admin to read a conversation they are not in. Every call is recorded.
create or replace function public.academy_chat_open_report(p_report uuid)
returns table(message_id uuid, sender_name text, body text, link_url text, created_at timestamptz, deleted boolean, reported boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); r public.academy_chat_reports%rowtype;
begin
  if not public.academy_is_admin() then raise exception 'Only an administrator can open reports' using errcode = '42501'; end if;
  select * into r from public.academy_chat_reports where id = p_report;
  if r.id is null then raise exception 'Report not found'; end if;
  insert into public.academy_chat_admin_access (report_id, conversation_id, admin_staff_id) values (r.id, r.conversation_id, me);
  return query
    select m.id, coalesce(s.display_name, 'Staff member'), m.body, m.link_url, m.created_at, m.deleted_at is not null,
      exists (select 1 from public.academy_chat_reports x where x.message_id = m.id)
    from public.academy_chat_messages m join public.academy_staff s on s.id = m.sender_staff_id
    where m.conversation_id = r.conversation_id order by m.created_at, m.id;
end $$;

create or replace function public.academy_chat_handle_report(p_report uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.academy_is_admin() then raise exception 'Only an administrator can handle reports' using errcode = '42501'; end if;
  if char_length(coalesce(v_note, '')) > 500 then raise exception 'Note is too long (500 characters at most)'; end if;
  update public.academy_chat_reports set handled_at = now(), handled_by_staff_id = me, handled_note = v_note
    where id = p_report and handled_at is null;
  if not found then raise exception 'Report not found or already handled'; end if;
end $$;

-- 7. Permissions on functions ---------------------------------------------------------------------------------------------
revoke execute on function public.academy_chat_is_member(uuid), public.academy_chat_participants(uuid),
  public.academy_chat_require_staff(), public.academy_chat_staff_directory(), public.academy_chat_conversation_list(),
  public.academy_chat_start_direct(uuid), public.academy_chat_send(uuid, text, text), public.academy_chat_delete_message(uuid),
  public.academy_chat_mark_read(uuid), public.academy_chat_report(uuid, text), public.academy_chat_report_list(),
  public.academy_chat_open_report(uuid), public.academy_chat_handle_report(uuid, text) from public, anon;
grant execute on function public.academy_chat_is_member(uuid), public.academy_chat_participants(uuid),
  public.academy_chat_require_staff(), public.academy_chat_staff_directory(), public.academy_chat_conversation_list(),
  public.academy_chat_start_direct(uuid), public.academy_chat_send(uuid, text, text), public.academy_chat_delete_message(uuid),
  public.academy_chat_mark_read(uuid), public.academy_chat_report(uuid, text), public.academy_chat_report_list(),
  public.academy_chat_open_report(uuid), public.academy_chat_handle_report(uuid, text) to authenticated;

-- Reports and admin openings go to the audit trail (messages do not: their text stays out of the audit log).
drop trigger if exists academy_audit_chat_reports on public.academy_chat_reports;
create trigger academy_audit_chat_reports after insert or update on public.academy_chat_reports
  for each row execute function public.academy_audit();

-- 8. Live updates: Supabase Realtime sends new messages to members (it applies the read rules above).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'public' and tablename = 'academy_chat_messages') then
    alter publication supabase_realtime add table public.academy_chat_messages;
  end if;
end $$;

commit;
