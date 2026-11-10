# Reference-system research log (not REA output)

Source inspected: https://github.com/Globussoft-Technologies/globussoft-school-mis
Inspected on: 2026-10-15.
Source license: AGPL-3.0, as stated by the original repository's LICENSE file.
Method: read public repository README, LICENSE and directory structure; **REA analysis has not run**.

## Broad observed product areas (claimed by reference README; not independently tested end-to-end)

- Admission and academics; timetable and learning management
- Attendance and assessments / grades
- Fee administration and dashboards
- Guardian / parent communications and role-specific portals
- Staff and other institutional operations

## BigChange-specific functional specification to implement independently

- Three personas: learner, teacher, administrator; extend guardian and finance roles later.
- Learner: sees upcoming lessons, homework, learning progress.
- Teacher: records attendance, posts classes and evaluates work.
- Administrator: manages course catalog and enrollment, oversees **externally paid** fee ledger.
- Finance: record/verify paid amount, show balance, then optionally send receipt notice via authorized channels.
- Non-goals for v1: transport, hostel, payroll, payment gateways.

## Intellectual-property process

- Never copy source code, layouts, screenshots, graphics, branding or copyrighted text.
- Write a functional feature specification first, then build original code.
- Keep record of source, license, study date and independently authored architecture.
- Do not use captured credentials, bypass access controls or analyze nonpublic student records.
- REA, if used later, must run only on software and environments with appropriate permission. Any actual REA artifacts must be labeled separately.
