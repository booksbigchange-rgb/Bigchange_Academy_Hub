# M5.7 — Deep people-management audit

This pass checked GitHub source and CI tests for the original independent Academy prototype. It has **not** been authenticated or manually tested on a physical Chromebook/browser. Everything remains fictional browser state.

## Confirmed issues and implemented repairs

| Finding | Impact | Repair |
|---|---|---|
| Administrator Overview displayed "Instructors" as **assigned** teacher count | Creating an idle teacher did not change the dashboard number; Add Teacher appeared broken | Show **Teachers** as full sample directory count, separately label number assigned to groups |
| Overview counted only learners with existing classroom enrollments | Newly registered but unenrolled sample student didn't change a dashboard metric | Show **Registered students** as all directory entries; subtitle gives actual enrolled unique learners |
| Both Add Teacher and Add Student overview shortcuts went to the same People page without selecting a specific form | User still had to search visually for the correct form | Each button now puts keyboard focus in its own controlled text field |
| The Teacher Directory form filtered permitted groups in the UI but called the unrestricted enrollment helper | Regression risk if a future UI refactor forgets the filter | Add a **demo-only role-aware enrollment helper** that rejects non-educator roles and a teacher enrolling into a class not assigned to Instructor A |
| Existing QA did not exercise created teacher+student through analytics/attendance and grades | Cross-feature regressions might be missed | Added unit/integration-model tests for registration counts, class assignment, enrollment, attendance opportunities, grade task-seats and family linkage rejection |

## Still missing; not misrepresented as fixed

- Newly created teacher/student records do not create logins; Teacher and Student previews still represent Instructor A and Learner A. Future prototype could add a **fake identity selector**, but true login must be server-authenticated.
- No Add Guardian or Add Administrator provisioning. Guardian-child linking **must never become self-service** without custody/consent checks.
- No edit/deactivate/delete workflows, invitation service, credentials or protected personal records. No CRUD persistence.
- Browser role switching remains illustrative only, not security. Model-level role checks are not a substitute for RLS policies or server-side permission enforcement.
- Reported roster counts are current snapshots; enrollments lack historical dates. Fee transactions remain externally recorded fictional figures.
- No manual screenshot/keyboard/Chromebook verification in this code-only audit, no 100-teacher scalability test.
- Real school usage remains blocked until the paused Supabase M6, verified identities/guardians, privacy/legal review, backups and data access controls.

## Reviewer steps
1. Administrator Overview should initially display **16 Registered students**, **3 Teachers**, **4 Class groups** and **ETB 4,000 Balances due**.
2. Click **+ Add Teacher**. The People & Roles teacher-name input should receive focus automatically. Create `Sample Teacher Delta`; return to Overview and see **4 Teachers**, with only 3 assigned.
3. Click **+ Add Student**. Focus should move to student-name input. Create `Sample Learner Indigo`; return to Overview and see **17 Registered students**, while the enrolled-learner subtitle remains 8.
4. In Classes, assign the new teacher to a sample group. In People & Roles, enroll the new learner into Computer Foundations.
5. Verify group roster, Instructor name, Teacher filter and grade/attendance/report denominators change correctly.
6. Switch to Teacher; People & Roles should offer enrollment into Instructor A classes only. A class assigned to Teacher B must not be offered.
7. Switch to Student and Guardian; neither can create users or arbitrarily claim a learner.
8. Refresh should reset all fictitious records. Never type real names or financial details.

To confirm deployment, check both **CI** and **Temporary web preview** GitHub Actions green before reviewing the URL.
