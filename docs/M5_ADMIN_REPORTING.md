# M5 — Admin reporting and external-fee reconciliation (fictional demo)

This independent frontend reports on M1 class groups, M2 scheduled attendance, M3 assessments and the M4-related offline-fee ledger. It does not connect to Supabase, verify transactions, collect tuition or store real students.

## Features
- **Administrator → Reports**: term, course, instructor and payment-period selectors.
- Current enrollment counts distinguish unique students from class enrollments. Course seat capacity and utilization bars are a current snapshot, **not a time-series trend**: dated enrollment events do not exist yet.
- Teacher allocation lists group counts, unique learners, enrollments, estimated two sessions/week per group and term-specific planned sessions.
- Attendance reports Present, Late, Absent, Excused and Unmarked as distinct values. The marked rate divides (Present + Late) by (Present + Late + Absent), excluding Excused and Unmarked.
- Assessment summaries show assigned task-seats, submitted, awaiting review, graded and graded-only averages (unsubmitted work not counted as zero).
- Offline fees are reconciled academy-wide by payment period only. Academic filtering never silently attributes fee payments to teachers/classes. Invalid/overpaid synthetic ledger rows are flagged and excluded from totals. Session-local Finance clicks are displayed as changes, **not a durable audit trail**.
- CSV export includes aggregates by class, course and instructor plus academy-wide financial totals. No learner names, guardian identities or individual fee/grade rows. Spreadsheet formula-like CSV entries are escaped.

## Reviewer walkthrough
1. Open public Academy demo → select Administrator → Reports.
2. Initial counts should be 4 groups, 10 enrollments, 8 unique fictional learners and 40 seats (25%).
3. Filter course to Computer Foundations: academic totals change; the 4,000 ETB academy-wide fee outstanding remains unchanged.
4. Filter term to Jan–Mar 2027: no scheduled sessions and attendance rate is **—**, not 0%.
5. Go to Classes and enroll a fictional learner. Return to Reports; capacity/rosters update.
6. Go to Attendance and mark a fictional session. Return to Reports and confirm change.
7. Student → Quizzes: complete an example quiz, then Administrator → Reports → Grades: graded totals update.
8. Administrator → Finance: record a 500 ETB sample payment against the partially paid learner. Return to Reports → Finance: outstanding is 3,500 ETB, with a browser-only change entry.
9. Export CSV; verify only aggregated rows and no learner/guardian names.
10. Validate on a Chromebook-size viewport and small-screen layout. Browser refresh resets changes.

## Still blocked from production
No verified identity access, backend report RLS, real child privacy/legal review, secure history/audit, financial receipt verification, actual historical enrollment tracking, paginated large-data reporting, backups or scale test for 100 teachers / 300 groups / ~3,000 enrollment seats. Supabase work is intentionally on hold.
