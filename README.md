# BigChange Academy Hub

A new, independently written school learning and management application for BigChange Academy — **not a fork** of Globussoft.

> **Prototype only:** uses fictional data. This version has **no authentication, real student records, payment processing, database or outgoing messages**. The demo role switcher is not an authorization mechanism.

## What is implemented

- Responsive student, teacher and administrator preview dashboards
- Sample course exercises, simulated assignment submission/review and editable fictional attendance
- Administrator finance screen with **fictional offline-payment recording** and updated Paid/Partial/Unpaid balances; no payments or messages are sent
- GitHub Actions workflow to type-check, test finance calculations and build on each push / pull request

**Demo interactions never persist.** Refresh to reset. No database, authentication, verified permissions or parent messaging is connected. A separate draft Supabase schema is deny-by-default and has **not been applied**.

## Run locally (optional)

Requires Node.js 22 and npm.

```bash
npm install
npm run dev
```

Visit the localhost address printed by Vite. Also run `npm test`, `npm run typecheck`, `npm run build`.

Use the **feature/initial-student-hub** branch for work. The `main` branch remains the conservative baseline.

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
