# BigChange Academy Hub

A new, independently written school learning and management application for BigChange Academy — **not a fork** of Globussoft.

> **Prototype only:** uses fictional data. This version has **no authentication, real student records, payment processing, database or outgoing messages**. The demo role switcher is not an authorization mechanism.

## What is implemented

- Responsive student, teacher and administrator preview dashboards
- Illustrative courses, assignments and twice-weekly attendance
- Administrator finance screen showing a **sample external-payment ledger** with Paid/Partial/Unpaid status and outstanding totals
- GitHub Actions workflow to type-check, test finance calculations and build on each push / pull request

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
- [Finance: external payments only](docs/FINANCE_MODEL.md)
- [Reference research provenance; REA not yet run](docs/RESEARCH_REFERENCE.md)
- [Draft legal/privacy release gates](docs/PRIVACY_LEGAL_RELEASE_CHECKLIST.md)

Independent development: no code, visual assets or proprietary interface elements copied from [Globussoft School MIS](https://github.com/Globussoft-Technologies/globussoft-school-mis). That project's AGPL-3.0 license is recorded for provenance; it is **not** a license grant for copying its code into this independent project.

## Important release notes

GitHub Actions builds/tests; GitHub Pages is separate hosting. Do not deploy real-user functionality until authentication, row-level permissions, child-data/privacy review and recovery procedures have been built and tested.
