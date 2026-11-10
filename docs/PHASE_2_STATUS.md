# Phase 2: Interactive prototype and secure data design

Date: 2026-10-15 | Development branch: feature/initial-student-hub

## Implemented
- Courses now reveal short fictional practice exercises.
- Students can simulate task submission; teachers/admins can simulate review.
- Teachers/admins can mark attendance for four invented learners.
- Admin can record example ETB payments that were **received elsewhere**; balances update.
- All changes are temporary browser state. Nothing is saved, authenticated, sent or billed.
- Automated tests cover state transitions, invalid amounts and default-deny RLS draft.

## Not implemented / not connected
- Real login, Supabase backend, verified staff roles or private student records.
- Server-side finance audit, receipts, authorization or guardian communications.
- REA analysis: the public Globussoft repo was manually mapped only. No REA scan has run.

## Proposed migration
`supabase/migrations/20261015_0001_locked_schema.sql` is a **draft**, not executed. All 14 tables have RLS ENABLE + FORCE; none has end-user access policies. This is a locked starting point, not a functioning backend. Do not apply it to the unrelated existing Supabase project. Next steps are a dedicated project, authenticated identity design, RLS policies and cross-user/guardian isolation tests, then secure backend write paths.

## Release gates
- Verify minors' data safeguards, guardian contacts and local privacy requirements with qualified reviewers.
- Perform threat modelling, role/isolation tests, encrypted storage, access logs and backups.
- Keep messaging disabled until verified contacts, lawful authorization/consent and approved WhatsApp Business or email service are ready.
- No public sample role selector on a real authenticated school product.
