# Draft compliance / risk controls — NOT a complete legal policy

This is a planning checklist, **not legal advice**, a privacy notice ready for publication, or evidence of legal compliance. Qualified local counsel should determine applicable Ethiopian and other jurisdictional requirements before handling real children's data.

## Required before public use

- [ ] Identify legal operator, country, school/controller relationships and eligible minors/guardians.
- [ ] Map personal data: student identity, school records, guardian contacts, attendance, grades, finance, messages and uploads.
- [ ] Decide documented lawful bases, notice/parent/guardian consent requirements, retention periods, subject access, correction and deletion procedures.
- [ ] Assess whether a privacy impact assessment and special child-data protections are required.
- [ ] Publish tailored privacy notice, terms of service and acceptable-use rules; do not publish generic promises that conflict with actual operations.
- [ ] Establish incident response, reporting duties and vendor/data-processing agreements.
- [ ] Test authentication, least-privilege authorization, Row Level Security and separation of student/guardian records.
- [ ] Establish encryption, secrets management, secure file storage, deletion, backups, access logs and recovery tests.
- [ ] Audit dependencies, software and media licenses, trademark use and source provenance.
- [ ] Document cross-border hosting and transfer conditions for each provider.
- [ ] Confirm fee tracking/accounting record and receipts requirements; avoid storing sensitive financial details unnecessarily.
- [ ] Obtain appropriate contact preferences and consent/legal authorization before any parent emails or WhatsApp messages; support opt-out where required.
- [ ] Verify WhatsApp Business/platform messaging rules and approved templates where applicable.
- [ ] Ensure no unverified demo credentials or fictional role switcher is deployed as real access control.
- [ ] Sign off with management and appropriate professional reviewers.

## Where the app stands (2026-11-15)

Internal staff tool. There is a real Supabase database, used with test data only. No payment gateway: the app records what staff report. No automatic messaging: staff send reminders and notices from their own WhatsApp or email, and only to parents whose agreement is recorded. Sign-in is restricted to accounts the admin created; public sign-up is off.

Already covered by automated tests on every change (the box above stays open until the owner has also run `tests/live-project-check.mjs` on the real project): least-privilege access and Row Level Security (150 database checks), separation of each family's records, dependency audit (0 known vulnerabilities).

This checklist must be reviewed and updated per feature/release, not assumed to make every future project compliant.
