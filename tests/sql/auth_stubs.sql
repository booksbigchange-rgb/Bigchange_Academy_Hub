-- Minimal stand-ins for what Supabase provides, so the migrations and the role tests can run on a plain PostgreSQL 16.
-- For throwaway local/CI databases only. Never run this on a Supabase project.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists deleted_at timestamptz;
-- The tests choose the signed-in user with: select set_config('request.sub', '<uuid>', false);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Stand-in for Supabase Storage (buckets and objects with row-level security), for the chat files rules (migration 0012).
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid default nullif(current_setting('request.sub', true), '')::uuid, metadata jsonb,
  created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert on storage.objects to authenticated;
