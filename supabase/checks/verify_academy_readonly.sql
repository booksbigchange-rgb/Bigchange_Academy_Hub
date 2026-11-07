-- READ-ONLY Academy security verification.
-- Run only in the NEW BigChange Academy Supabase project.
-- Expected AFTER migrations 0001, 0002 and 0003: 15 tables, 0 without RLS, 0 without FORCE RLS,
-- 42 policies (40 after 0002 alone, with 14 tables), and 0 tables with no policy. (If you applied the older profile-policy file
-- only, expect 3 policies and a nonzero unexpected_policy_count.)
with academy_tables as (
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname like 'academy_%'
),
academy_policies as (
  select tablename, policyname, cmd, roles, qual
  from pg_policies
  where schemaname='public' and tablename like 'academy_%'
)
select
  (select count(*) from academy_tables) as academy_table_count,
  (select count(*) from academy_tables where not relrowsecurity) as missing_rls,
  (select count(*) from academy_tables where not relforcerowsecurity) as missing_force_rls,
  (select count(*) from academy_policies) as policy_count,
  (select count(*) from academy_tables t
     where not exists (select 1 from academy_policies p where p.tablename=t.relname)) as tables_without_policy,
  (select count(*) from academy_policies where roles::text like '%anon%' or roles::text like '%public%') as anon_or_public_policies;
-- WARNING: This query checks schema configuration, not actual user authorization.
-- Full multi-user RLS and child-data privacy tests are still mandatory.
