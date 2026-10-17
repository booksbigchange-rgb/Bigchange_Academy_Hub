# M5.5 Frontend QA and stabilization

No Supabase changes, real child records, payments, or secure permissions are included. The app is a fiction-only preview.

## Confirmed code findings and fixes
- Student and Teacher dashboard cards had hardcoded counts and attendance percentages, contrary to actual rosters and session marks. Overview is now computed from current groups, attendance and submissions.
- Courses displayed only three manually entered subjects and fabricated completion percentages. The app now uses the full five-subject canonical catalog; Student and Teacher see courses assigned in their fictional groups, Administrator sees all five. Cards show group counts instead of unearned progress claims.
- Guardian child selection and notification checkbox state reset between Overview and Family due to a section-based React key. Removed the key so state remains during Guardian navigation.
- Chromebook/mobile support improved with wider touch targets, explicit keyboard focus, wrapping course cards and horizontal navigation containment.

## Tests
The dashboard QA suite covers role navigation, canonical course lists, derived student/teacher/admin cards, enrollment and per-session attendance updates, Student-to-Teacher grading, Guardian report isolation, and fee report consistency. Existing unit/security tests remain in GitHub CI.

These are pure-code and component-contract tests: NOT a real browser clickthrough, physical device test, security penetration test, or 100-teacher load test.

## Manual verification still required
1. Public demo: Student Overview should show 2 groups, 3 assignments to do and attendance marked 1/3; Courses only Computer Foundations and Creative Design.
2. Teacher Overview: 2 groups, 5 unique learners, zero awaiting review initially; Courses Computer Foundations and Introduction to AI.
3. Administrator Overview: 8 unique learners, 4 active courses, 3 instructors and ETB 4,000 outstanding; Courses lists five subjects including Automation with zero groups.
4. Guardian Family: switch to Learner C, navigate Overview and back, confirm Learner C and demo channel preferences stay selected.
5. Student submit a sample project, Teacher grade it, Student take a quiz; Guardian and Reports should update without real data.
6. On Chromebook-like 1366×768 and narrow 320–520px screens, check keyboard focus, horizontal sidebar, report tabs and roster tables.
7. Refresh resets changes; the separate adult pilot.html sign-in should be unaffected.

## Release blockers
The role switcher is not authorization. Supabase RLS, verified teacher/student/guardian identities, protected file storage, credible financial audit, real enrollment history, accessibility testing, backups, legal/child privacy checks and load tests are still required before production.
