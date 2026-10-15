# BigChange Academy Hub

A new, independently written school learning and management application for BigChange Academy — **not a fork** of Globussoft.

> **Prototype only:** uses fictional data. The public preview uses fictional data, with no connected database or real student records, payment processing, or outgoing messages. An optional **separate sign-in gate** exists in code but is not configured or deployed for real users. The demo role switcher is not an authorization mechanism.

## What is implemented

- Responsive student, teacher and administrator preview dashboards
- Sample course exercises, simulated assignment submission/review and editable fictional attendance
- Administrator finance screen with **fictional offline-payment recording** and updated Paid/Partial/Unpaid balances; no payments or messages are sent
- GitHub Actions workflow to type-check, test finance calculations and build on each push / pull request

**Demo interactions never persist.** Refresh to reset. No database or parent messaging is connected. A separate Supabase Auth sign-in gate stays **disabled** until two dedicated-project configuration variables are supplied. A separate draft Supabase schema is deny-by-default and has **not been applied**.

## Run locally (optional)

Requires Node.js 22 and npm.

```bash
npm install
npm run dev
```

Visit the localhost address printed by Vite. Also run `npm test`, `npm run typecheck`, `npm run build`.

Use the **feature/initial-student-hub** branch for work. The `main` branch remains the conservative baseline.

## Secure foundation (inactive on public Pages)

The optional Supabase sign-in route requires a **new dedicated Academy project** and its *publishable* key as described in `.env.example`. Do not add real credentials to GitHub Pages or use the existing Supabase project belonging to another app. When configured, the public role-switch demo is replaced entirely by a private sign-in screen. New accounts cannot self-register. Only a server-verified user with an RLS-protected Academy identity row is recognized; enrollment and finance operations remain **disabled**.

- See [Security Foundation Handoff](docs/SECURITY_FOUNDATION.md) and [own-profile policy draft](supabase/policies/academy_profile_access.sql).
- All other student, guardian, finance and school records continue to be denied by default.
- Review privacy, minors' consent, tenancy, data residency, audit trails and RLS integration tests before allowing any real-user use.

## Roadmap and safeguards

- [Architecture and planned production security](docs/ARCHITECTURE.md)
- [Phase 2 status and release gates](docs/PHASE_2_STATUS.md)
- [Draft deny-by-default school schema](supabase/migrations/20261015_0001_locked_schema.sql)
- [Finance: external payments only](docs/FINANCE_MODEL.md)
- [Reference research provenance; REA not yet run](docs/RESEARCH_REFERENCE.md)
- [Draft legal/privacy release gates](docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md)

Independent development: no code, visual assets or proprietary interface elements copied from [Globussoft School MIS](https://github.com/Globussoft-Technologies/globussoft-school-mis). That project's AGPL-3.0 license is recorded for provenance; it is **not** a license grant for copying its code into this independent project.

## Important release notes

GitHub Actions builds/tests; GitHub Pages is separate hosting. Do not deploy real-user functionality until authentication, row-level permissions, child-data/privacy review and recovery procedures have been built and tested.
