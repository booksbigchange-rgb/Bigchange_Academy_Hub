-- Minimal stand-ins for what Supabase provides, so the migrations and the role tests can run on a plain PostgreSQL 16.
-- For throwaway local/CI databases only. Never run this on a Supabase project.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
-- The tests choose the signed-in user with: select set_config('request.sub', '<uuid>', false);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
