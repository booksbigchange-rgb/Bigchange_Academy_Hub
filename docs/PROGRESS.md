# Progress log (audit and finish pass)

Baseline (branch tip M5.15, `60ebf49`): typecheck OK, 97/97 tests, build OK.

## Done in this pass
- Fee status now includes **Overdue** (unpaid/partial and fee month already ended; assumption until the school defines due dates). `src/lib/finance.mjs`.
- Finance → **Reminder queue**: lists outstanding fees, copies reminder text for staff to send manually. Shows "Not sent · no integration". Nothing is sent. `src/components/AcademyReminders.tsx`.
- Tests: 102/102 pass; typecheck and build pass.

## Remaining (needs owner input or credentials)
1. Persistence and real auth: Supabase project key, migrations, RLS tests.
2. Email/WhatsApp provider, parent contact and consent records.
3. Payment-status audit trail server-side (current history is in-memory).
4. (Done) Teacher and student detail view with editable grade/specialty and note; see `src/components/AcademyPersonProfile.tsx`.
5. Manual Chromebook/mobile/screen-reader testing.
6. Merge strategy for the 18 stacked draft PRs.
