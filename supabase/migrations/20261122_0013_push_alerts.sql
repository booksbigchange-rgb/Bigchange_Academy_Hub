-- BigChange Academy — migration 0013: phone alerts for staff chat (M6 step 5, docs/PUSH_ALERTS.md).
-- Run in the Academy project's SQL Editor AFTER 0012. Safe to run again.
-- Adds 1 table and 1 policy (the verify script then expects 25 tables and 54 policies).
--
-- How alerts work
--  1. A staff member presses "Turn on alerts". Their browser gives a push address; academy_push_subscribe() stores it.
--  2. After sending a message, the app calls the Edge Function "notify-message" with the message id.
--  3. The function asks academy_chat_claim_push() (as the sender) whether it may alert for that message: only the sender,
--     only within 2 minutes, and only once per message.
--  4. With the service key it reads academy_chat_push_targets(): the push addresses of the conversation's other active
--     members. Nobody else can call that function.
--  5. The alert says "New message from <name> in <chat>". The message text is never sent to the push service.
-- Switched-off staff stop getting alerts at once (they are no longer members). Addresses that the push service reports as
-- gone are removed by the function (academy_push_remove_dead).
begin;

do $$ begin
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table if not exists public.academy_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.academy_staff(id),
  endpoint text not null unique check (endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth_secret text not null check (char_length(auth_secret) between 8 and 100),
  device_label text check (device_label is null or char_length(device_label) <= 120),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists academy_push_subscriptions_staff_idx on public.academy_push_subscriptions (staff_id);
alter table public.academy_push_subscriptions enable row level security;
alter table public.academy_push_subscriptions force row level security;
revoke all on public.academy_push_subscriptions from anon, authenticated;
grant select on public.academy_push_subscriptions to authenticated;
drop policy if exists academy_push_subscriptions_select on public.academy_push_subscriptions;
create policy academy_push_subscriptions_select on public.academy_push_subscriptions for select to authenticated
  using (staff_id = public.academy_staff_id());

alter table public.academy_chat_messages add column if not exists push_claimed_at timestamptz;

-- 1. Staff: turn alerts on/off for this device ------------------------------------------------------------------------
create or replace function public.academy_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.academy_chat_require_staff();
begin
  if p_endpoint is null or p_endpoint !~ '^https://[^[:space:]]+$' or char_length(p_endpoint) > 1000 then raise exception 'This browser gave an invalid alert address'; end if;
  if char_length(coalesce(p_p256dh, '')) not between 20 and 200 or char_length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'This browser gave invalid alert keys';
  end if;
  -- One device = one address. If another person used this browser before, the address moves to the signed-in person.
  insert into public.academy_push_subscriptions (staff_id, endpoint, p256dh, auth_secret, device_label)
  values (me, p_endpoint, p_p256dh, p_auth, left(nullif(btrim(coalesce(p_label, '')), ''), 120))
  on conflict (endpoint) do update set staff_id = excluded.staff_id, p256dh = excluded.p256dh, auth_secret = excluded.auth_secret,
    device_label = excluded.device_label, last_seen_at = now();
end $$;

create or replace function public.academy_push_unsubscribe(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.academy_staff_id();
begin
  -- Also works for switched-off staff signing out (they may remove their own address, nothing else).
  delete from public.academy_push_subscriptions s using public.academy_staff st
  where s.endpoint = p_endpoint and st.id = s.staff_id and st.auth_user_id = (select auth.uid());
end $$;

-- 2. The sender may ask for alerts once, within 2 minutes ---------------------------------------------------------------
create or replace function public.academy_chat_claim_push(p_message uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.academy_chat_require_staff();
begin
  update public.academy_chat_messages set push_claimed_at = now()
  where id = p_message and sender_staff_id = me and push_claimed_at is null and deleted_at is null
    and created_at > now() - interval '2 minutes';
  return found;
end $$;

-- 3. Service only: where to send the alert, and what it says ---------------------------------------------------------
create or replace function public.academy_chat_push_targets(p_message uuid)
returns table(subscription_id uuid, endpoint text, p256dh text, auth_secret text, title text, body text, conversation_id uuid)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare m public.academy_chat_messages%rowtype; c public.academy_chat_conversations%rowtype; v_sender text; v_chat text;
begin
  select * into m from public.academy_chat_messages where id = p_message and push_claimed_at is not null and deleted_at is null;
  if m.id is null then return; end if;
  select * into c from public.academy_chat_conversations where id = m.conversation_id;
  select coalesce(display_name, 'A colleague') into v_sender from public.academy_staff where id = m.sender_staff_id;
  v_chat := case when c.kind = 'direct' then null
                 when c.group_key = 'all_staff' then 'All staff' when c.group_key = 'teachers' then 'Teachers'
                 when c.group_key = 'finance' then 'Finance'
                 else coalesce((select k.title from public.academy_classes k where k.id = c.class_id), 'a class group') end;
  return query
    select s.id, s.endpoint, s.p256dh, s.auth_secret, 'BigChange Academy'::text,
      'New message from ' || v_sender || coalesce(' in ' || v_chat, ''), c.id
    from public.academy_push_subscriptions s
    join public.academy_staff st on st.id = s.staff_id
    where st.active and st.id <> m.sender_staff_id
      and (
           (c.kind = 'direct' and exists (select 1 from public.academy_chat_members x where x.conversation_id = c.id and x.staff_id = st.id))
        or c.group_key = 'all_staff'
        or (c.group_key = 'teachers' and st.role in ('teacher', 'admin'))
        or (c.group_key = 'finance' and st.role in ('finance', 'admin'))
        or (c.class_id is not null and (st.role = 'admin' or exists (select 1 from public.academy_classes k where k.id = c.class_id and k.teacher_staff_id = st.id))));
end $$;

create or replace function public.academy_push_remove_dead(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.academy_push_subscriptions where id = any (p_ids) $$;

revoke execute on function public.academy_push_subscribe(text, text, text, text), public.academy_push_unsubscribe(text),
  public.academy_chat_claim_push(uuid), public.academy_chat_push_targets(uuid), public.academy_push_remove_dead(uuid[]) from public, anon;
grant execute on function public.academy_push_subscribe(text, text, text, text), public.academy_push_unsubscribe(text),
  public.academy_chat_claim_push(uuid) to authenticated;
revoke execute on function public.academy_chat_push_targets(uuid), public.academy_push_remove_dead(uuid[]) from authenticated;
grant execute on function public.academy_chat_push_targets(uuid), public.academy_push_remove_dead(uuid[]) to service_role;

commit;
