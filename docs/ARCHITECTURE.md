# Architecture and phased delivery

## Current prototype

- React + TypeScript + Vite; no servers, databases, authentication, or messaging configured.
- Student, Teacher and Administrator preview modes are **not authentication or authorization**.
- Course, attendance, assignment and finance data are fictional and hard-coded.
- Running the static preview is safe for testing; **do not put real student information into it**.

## Proposed production boundaries

1. UI: accessible responsive app for Chromebook/browser users.
2. Identity: Supabase Auth (or another reviewed provider) for staff and guardians. Minor account policies must be reviewed.
3. Database: PostgreSQL with enforced Row Level Security, tested at the API/data boundary; never trust a client role selector.
4. File storage: private buckets, content-type/size checks, signed retrieval; no public student uploads.
5. Finance ledger: record manually confirmed external payments with staff permissions, receipt number, payer/guardian association, audit log.
6. Notifications: isolated server-side service using an approved mail provider and/or WhatsApp Business integration. Explicit lawful basis/permission, templates, delivery logs, opt-outs and retries.
7. Monitoring: build tests, dependency scans, backups, disaster recovery, access auditing.

## Phases

- P0: prototype and original functional specifications, tests and CI.
- P1: authentication, RBAC, persistent data, RLS tests.
- P2: classes, lessons, attendance, homework and quizzes.
- P3: offline-payment recording, receipts, reconciliation and audit history.
- P4: consent-based email/WhatsApp receipts and reminders, notification settings and guardian verification.
- P5: launch review including legal policies, DPIA/child privacy assessment, security testing and operations runbook.

All changes through reviewed PRs. No real users until P5 acceptance.
