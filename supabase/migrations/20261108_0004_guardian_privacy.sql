-- BigChange Academy — guardian contact privacy fix (migration 0004). Run after 0001–0003. Safe to re-run.
-- Problem fixed: academy_add_guardian() reuses an existing parent when the phone or email matches. A teacher could
-- type a known phone number, get linked (pending) to that parent, and then read the parent's name and email before
-- any administrator verified the link. Now teachers see contact details only for VERIFIED links; for pending links
-- they see a placeholder. Administrators and finance still see everything (they verify links).
begin;
create or replace function public.academy_guardians_for_learner(p_learner uuid)
returns table (guardian_id uuid, display_name text, email text, phone_e164 text,
               email_opt_in boolean, whatsapp_opt_in boolean, verified boolean)
language sql stable security definer set search_path = '' as $$
  select g.id,
         case when l.verified_by_staff_id is not null or public.academy_is_finance() then g.display_name else 'Parent (waiting for verification)' end,
         case when l.verified_by_staff_id is not null or public.academy_is_finance() then g.email else null end,
         case when l.verified_by_staff_id is not null or public.academy_is_finance() then g.phone_e164 else null end,
         case when l.verified_by_staff_id is not null or public.academy_is_finance() then g.email_opt_in else false end,
         case when l.verified_by_staff_id is not null or public.academy_is_finance() then g.whatsapp_opt_in else false end,
         (l.verified_by_staff_id is not null)
  from public.academy_guardian_links l join public.academy_guardians g on g.id = l.guardian_id
  where l.learner_id = p_learner and (public.academy_is_finance() or public.academy_teaches_learner(p_learner)) $$;
revoke execute on function public.academy_guardians_for_learner(uuid) from public, anon;
grant execute on function public.academy_guardians_for_learner(uuid) to authenticated;
commit;
