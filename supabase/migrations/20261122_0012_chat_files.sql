-- BigChange Academy — migration 0012: photos and files in staff chat (M6 step 4, docs/M6_PHONE_AND_STAFF_CHAT_PLAN.md).
-- Run in the Academy project's SQL Editor AFTER 0011. Safe to run again.
-- Adds 1 table and 1 policy (the verify script then expects 24 tables and 53 policies), a PRIVATE storage bucket
-- "chat-files", and 3 storage rules.
--
-- Rules
--  * Files: up to 10 MB; PDF, Word, Excel, PowerPoint, CSV, plain text, and JPEG/PNG/WebP/HEIC photos. The bucket itself
--    refuses anything else, and so does the database when the file is attached to a message.
--  * Where a file lives: chat-files/<conversation id>/<random id>/<file name>. Only members of that conversation can upload
--    into its folder.
--  * Who can open a file: members of the conversation, while the message is not deleted. An admin can open the files of a
--    conversation only after opening a report on it (each opening is already recorded by academy_chat_open_report).
--    The app opens files through short-lived signed links; the bucket is never public.
--  * A file counts only once it is attached to a message with academy_chat_send_file(), which reads the real size and type
--    from storage (not what the phone claims). Deleting the message (own, within 15 minutes, not reported) also makes its
--    files unreachable. Files that were uploaded but never sent are removed by the clean-up job (step 7).
begin;

-- 1. Bucket --------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 10485760, array[
  'application/pdf', 'text/csv', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.academy_chat_file_types() returns text[]
language sql immutable set search_path = '' as $$
  select array['application/pdf', 'text/csv', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[] $$;

-- 2. Messages may now carry a file instead of text ----------------------------------------------------------------------
alter table public.academy_chat_messages add column if not exists has_file boolean not null default false;
alter table public.academy_chat_messages drop constraint if exists academy_chat_messages_check;
alter table public.academy_chat_messages drop constraint if exists academy_chat_messages_content;
alter table public.academy_chat_messages add constraint academy_chat_messages_content
  check (deleted_at is not null or body is not null or link_url is not null or has_file);

create table if not exists public.academy_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.academy_chat_messages(id) on delete cascade,
  conversation_id uuid not null references public.academy_chat_conversations(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 400),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type = any (public.academy_chat_file_types())),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index if not exists academy_chat_attachments_conv_idx on public.academy_chat_attachments (conversation_id, created_at);
alter table public.academy_chat_attachments enable row level security;
alter table public.academy_chat_attachments force row level security;
revoke all on public.academy_chat_attachments from anon, authenticated;
grant select on public.academy_chat_attachments to authenticated;
drop policy if exists academy_chat_attachments_select on public.academy_chat_attachments;
create policy academy_chat_attachments_select on public.academy_chat_attachments for select to authenticated
  using (public.academy_chat_is_member(conversation_id));

-- 3. Storage rules -----------------------------------------------------------------------------------------------------
-- The conversation a storage path belongs to, or null when the path is not ours (never errors on odd input).
create or replace function public.academy_chat_path_conversation(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}/[^/]{1,200}$'
              then split_part(p_name, '/', 1)::uuid end $$;

-- May the signed-in user open this stored file?
create or replace function public.academy_chat_can_open_file(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.academy_chat_attachments a
    join public.academy_chat_messages m on m.id = a.message_id
    where a.storage_path = p_name and m.deleted_at is null
      and (public.academy_chat_is_member(a.conversation_id)
           or (public.academy_is_admin() and exists (
                 select 1 from public.academy_chat_admin_access x
                 where x.conversation_id = a.conversation_id and x.admin_staff_id = public.academy_staff_id())))) $$;

drop policy if exists academy_chat_files_select on storage.objects;
create policy academy_chat_files_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and public.academy_chat_can_open_file(name));
drop policy if exists academy_chat_files_insert on storage.objects;
create policy academy_chat_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.academy_chat_is_member(public.academy_chat_path_conversation(name)));
-- No update or delete rules: staff cannot overwrite or remove stored files (the clean-up job does that).

-- 4. Sending a file ----------------------------------------------------------------------------------------------------
create or replace function public.academy_chat_send_file(p_conv uuid, p_body text, p_path text, p_file_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := public.academy_chat_require_staff(); v_body text := nullif(btrim(coalesce(p_body, '')), '');
        v_name text := btrim(coalesce(p_file_name, '')); o record; v_size bigint; v_mime text; v_id uuid;
begin
  if not public.academy_chat_is_member(p_conv) then raise exception 'Not a member of this conversation' using errcode = '42501'; end if;
  if public.academy_chat_path_conversation(p_path) is distinct from p_conv then raise exception 'File is not in this conversation'; end if;
  if char_length(coalesce(v_body, '')) > 4000 then raise exception 'Message is too long (4,000 characters at most)'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 200 then raise exception 'File name is missing or too long'; end if;
  select * into o from storage.objects where bucket_id = 'chat-files' and name = p_path;
  if not found then raise exception 'The file did not finish uploading. Please try again.'; end if;
  if o.owner is distinct from (select auth.uid()) then raise exception 'You can send only files you uploaded' using errcode = '42501'; end if;
  if exists (select 1 from public.academy_chat_attachments where storage_path = p_path) then raise exception 'This file was already sent'; end if;
  v_size := nullif(o.metadata->>'size', '')::bigint;
  v_mime := lower(coalesce(o.metadata->>'mimetype', ''));
  if v_size is null or v_size < 1 or v_size > 10485760 then raise exception 'Files can be at most 10 MB'; end if;
  if not (v_mime = any (public.academy_chat_file_types())) then raise exception 'This kind of file cannot be sent'; end if;
  insert into public.academy_chat_messages (conversation_id, sender_staff_id, body, has_file)
  values (p_conv, me, v_body, true) returning id into v_id;
  insert into public.academy_chat_attachments (message_id, conversation_id, storage_path, file_name, mime_type, size_bytes)
  values (v_id, p_conv, p_path, v_name, v_mime, v_size);
  insert into public.academy_chat_reads (conversation_id, staff_id, last_read_at) values (p_conv, me, now())
    on conflict (conversation_id, staff_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end $$;

-- Deleting a message also removes its attachment records, so its files can no longer be opened.
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
  delete from public.academy_chat_attachments where message_id = p_message;
  update public.academy_chat_messages set body = null, link_url = null, has_file = false, deleted_at = now() where id = p_message;
end $$;

-- Admin view of a reported conversation: also the file names (files open only after this call, see above).
create or replace function public.academy_chat_report_files(p_report uuid)
returns table(message_id uuid, storage_path text, file_name text, mime_type text, size_bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare r public.academy_chat_reports%rowtype;
begin
  if not public.academy_is_admin() then raise exception 'Only an administrator can open reports' using errcode = '42501'; end if;
  select * into r from public.academy_chat_reports where id = p_report;
  if r.id is null then raise exception 'Report not found'; end if;
  if not exists (select 1 from public.academy_chat_admin_access x where x.report_id = r.id and x.admin_staff_id = public.academy_staff_id()) then
    raise exception 'Open the conversation first';
  end if;
  return query select a.message_id, a.storage_path, a.file_name, a.mime_type, a.size_bytes
    from public.academy_chat_attachments a where a.conversation_id = r.conversation_id order by a.created_at;
end $$;

revoke execute on function public.academy_chat_send_file(uuid, text, text, text), public.academy_chat_report_files(uuid),
  public.academy_chat_can_open_file(text) from public, anon;
grant execute on function public.academy_chat_send_file(uuid, text, text, text), public.academy_chat_report_files(uuid),
  public.academy_chat_can_open_file(text) to authenticated;
grant execute on function public.academy_chat_path_conversation(text), public.academy_chat_file_types() to authenticated;

-- 5. Previews in the chat list show "File" for a file-only message (same function as 0011, one line changed).
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
           else left(coalesce(lm.body, lm.link_url, case when lm.has_file then 'File' end), 120) end,
      (select count(*)::integer from public.academy_chat_messages x
        where x.conversation_id = c.id and x.sender_staff_id <> me and x.deleted_at is null
          and x.created_at > coalesce((select r.last_read_at from public.academy_chat_reads r
                                       where r.conversation_id = c.id and r.staff_id = me), '-infinity'::timestamptz))
    from mine c
    left join other o on o.conversation_id = c.id
    left join lateral (
      select x.id, x.created_at, x.body, x.link_url, x.has_file, x.deleted_at, coalesce(s.display_name, 'Staff member') as sender_name
      from public.academy_chat_messages x join public.academy_staff s on s.id = x.sender_staff_id
      where x.conversation_id = c.id order by x.created_at desc limit 1) lm on true
    order by lm.created_at desc nulls last,
      case c.group_key when 'all_staff' then 1 when 'teachers' then 2 when 'finance' then 3 else 4 end, c.id;
end $$;

commit;
