# Supabase setup

This page used to describe an earlier, now superseded setup (a different project and a single own-profile policy file).

**Use the current steps in the [README → Setup from scratch](../README.md#setup-from-scratch).** They apply migrations 0001 → 0002 → 0003, verify (15 tables, 42 policies), and create logins with the scripts in `supabase/manual/`.

Do not run `supabase/policies/academy_profile_access.sql`; migration 0002 replaces it. Never paste a secret/service-role key or database password into chat, GitHub or `.env`.
