# Academy Hub — product parity and milestones

Updated: 2026-10-17. Evidence: current independent BigChange feature branch and the reference repository's public module list documented in [FEATURE_MAPPING.md](FEATURE_MAPPING.md).
**Reference is not a source of code.** We are developing original implementation of relevant workflows, not importing AGPL components or copying visuals.

## Target and scale
- 100 teachers, about three groups each = **300 groups**; 10 learners per group = **3,000 class enrollments**, not necessarily 3,000 unique students.
- Up to several thousand adults/guardians accounts separately; estimate real MAU, uploads, database storage and transfer before a live rollout.
- Chromebook-first, small-screen accessible UI; low-bandwidth operation; 2 sessions/week example; Ethiopian birr offline-payment tracking.
- For minors, **no actual data** until reviewed permission policies, documented guardian authorization, verified identities, information security, legal privacy review and operational safeguards.

## Gap comparison and staged delivery

| Milestone | Workflow | Current state | Acceptance gate |
|---|---|---|---|
| M0 | Design baseline, course exercises, sample assignments/attendance, offline ledger, fictional role previews | **Done** (existing branches) | CI; no real records |
| M1 | Admin groups, teacher assignment, enrollment, group rosters, basic timetable, directory | **Implemented in feature/academy-operations-m1** (demo only) | Reject schedule clashes, capacity overflows, duplicate course enrollments; test role-based views; CI |
| M2 | Academic planning: terms, course modules, lesson plans, class-specific sessions/attendance | **Implemented in feature/academy-academics-m2** (demo only) | Term/date validation, schedule-day enforcement, per-session marks, visible corrections; backend authorization still pending |
| M3 | Assignments and assessments: publish, submit, review, quizzes, rubrics, progress / grades | **Implemented in feature/academy-assessments-m3** (demo only) | Per-class task/term scoping, quiz scoring, rubric checks, student progress tested; backend permissions still missing |
| M4 | Guardian view, notification preference, child progress, attendance and fee snapshots | **Implemented in feature/academy-guardian-m4** (fictional demo only) | Synthetic links, child-scope reports, no messages or contacts; real guardian verification remains blocked |
| M5 | Admin aggregates: enrollment snapshot, utilization, instructor load, attendance, grades, offline fee reconciliation | **Implemented in feature/academy-reporting-m5** (fictional demo only) | Aggregated CSV/formula escape, filter boundaries, invalid ledger flags verified; real audit and privacy still blocked |
| M6 | Backend persistence and authorization integration | **On hold per owner request** | Auth, actual server RLS read/write isolation, backups, audit, private storage; no direct client trust |
| M7 | Real school readiness / scale, family consent, disaster recovery, accessibility/performance/load test | Later | Real-world pilot with adult test accounts first, security/legal review completed, backups tested |

## Feature classes deliberately excluded from scope
The reference includes modules for hostel, transport, payroll, library and other administrative operations. Those are outside BigChange's 3-month learning program and offer little value compared with teacher/student workflows. Prioritizing relevant functionality matters more than matching its module count.

## M1 demonstrated functionality (no backend)
- Administrator can add a group with fixed course, teacher, twice-weekly time and seat limit; inspect or remove enrollments, reassign teacher when schedule permits.
- Administrator can enroll only fictional learners, preventing duplicate course enrollment and class overcapacity.
- Teacher view shows Instructor A's sample groups and roster; student view shows Learner A's sample groups.
- Directory shows fictional teacher assignments and grouped learner counts; timetable derives from active groups.
- The entire operation uses React local in-memory state. **Browser refresh resets.** Preview role controls are not authorization. Never input names or money from real people.
- Tests run on pure immutable helpers; existing secure Auth pilot remains untouched. Public Pages deployment is not changed by this feature branch.

## Practical follow-on delivery
1. Review M2: create a fictional term, plan/edit lessons, mark/correct attendance for the right class/session; all state resets on refresh.
2. Review M3: test assignments, quiz auto-scoring, rubric reviews, gradebook and regrade corrections using fictional classroom identities.
3. Review M4 synthetic family reports, child linking, progress, attendance and offline-fee snapshots; no real guardian access exists.
4. Review M5 administrative Reports tab: current roster distribution (not historical trends), teacher load, marked attendance, graded outcomes and academy-wide offline finance reconciliation.
5. Separate live permissions/backend milestone only when the owner resumes Supabase, before real school use.

## Operational controls
- Keep working `main` and `feature/initial-student-hub` untouched; PR targets `feature/secure-foundation` for review.
- Deploy no real Auth or student records to the public demo; keep GitHub Pages as fictional preview.
- Use branch CI and check before merge; document migration of UI from synthetic state to server-owned records later.
