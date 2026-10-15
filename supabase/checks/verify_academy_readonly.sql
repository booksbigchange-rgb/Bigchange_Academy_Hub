-- READ-ONLY Academy security verification.
-- Run only in the NEW BigChange Academy Supabase project.
-- Expected AFTER both setup SQL scripts: 14 tables, 0 without RLS,
-- 0 without FORCE RLS, 3 policies and 0 unexpected policies.
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
  (select count(*) from academy_policies
     where policyname not in (
       'academy_staff_self_select',
       'academy_learner_self_select',
       'academy_guardian_self_select'
     )) as unexpected_policy_count;
-- WARNING: This query checks schema configuration, not actual user authorization.
-- Full multi-user RLS and child-data privacy tests are still mandatory.
