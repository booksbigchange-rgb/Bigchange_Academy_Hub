# Functional reference map — BigChange Academy Hub
Research date: 2026-10-15. Source: public directory listing `packages/api/src/modules/` in https://github.com/Globussoft-Technologies/globussoft-school-mis and that project's README/LICENSE. **Not a REA scan**, not evidence each feature is functional, and not copied code.

| Area | Observed Globussoft module path(s) | Independent BigChange capability | Phase |
|---|---|---|---|
| Identity / users | `auth`, `users` | Secure sign-in, role separation, least-privilege permissions | P1 |
| Student records | `students`, `admission` | Enrollment, guardian association, minimal student profiles | P1 |
| Course library | `lms-content`, `course-modules`, `syllabus` | Foundations, Canva, Wix, Scratch, AI and automation lessons | P2 |
| Homework | `assignments`, `grading`, `rubrics` | Teacher-assigned classwork and assessment feedback | P2 |
| Assessments | `assessments`, `reports` | Quizzes, progress summaries and marks | P2 |
| Attendance | `attendance`, `period-attendance` | Twice-weekly class attendance, absence explanations | P2 |
| Scheduling | `timetable`, `calendar`, `timetable-generator` | Lesson timetable and teacher schedule | P2 |
| Teacher workflow | `teaching`, `staff-directory` | Classes, lessons and submission review | P2 |
| Finance tracking | `fees`, `concessions`, `expenses`, `fee-automation` | **External payments only**; fee obligations, receipts, reconciliation and approvals | P3 |
| Guardians | `parent-portal` | Read-only child status and authorized contact details | P3 |
| Communications | `communication`, `email`, `notifications`, `message-log` | Consent-appropriate email/WhatsApp confirmations after verified payment | P4 |
| Activity logs | `audit`, `activity-log` | Staff actions, financial adjustments, permissions changes | P1–P4 |
| Achievement | `certificates`, `gamification`, `learning-paths` | Badges, certificates and milestone tracking | P4 |
| Leave and welfare | `student-leaves`, `health` | Optional later, privacy-restricted; not needed for MVP | Later |
| Institutional extras | `hostel`, `bus`, `payroll`, `library`, `inventory` | Not planned for current BigChange course-focused MVP | Out of scope |

## Planned authorized REA research runs

When REA is actually installed and pointed to a system we have permission to inspect, produce *independent behavior specs* for these flows in order:

1. **Administrator creates a class and enrolls student.** Document inputs, navigation, validations, outcomes and error cases.
2. **Teacher assigns homework and reviews submission.** Document each role boundary and progress update.
3. **Attendance marking.** Document lesson schedule, absent/present recording, corrections and audit trail.
4. **Finance admin records an offline payment.** Document amount, currency, proof/reference, verification, status transition and receipt.
5. **Guardian notification.** Document consent, event, reviewed template, verified destination, delivery and opt-out; no live message during analysis.

For each flow: capture permitted user-visible behavior, avoid extracting protected implementations or personal information, state uncertainties, and write an independent acceptance-test checklist. REA outputs must be identified by date/source and stored separately from these manual notes.

## Two essential security rules

- The React role picker in the current demo is illustrative **only**. Real staff/guardian/student record access must be authorized at the database and server level.
- A student must not be able to see another student's data or finance details. Guardian linkage and notification recipient identity must be server-verified.

The independent codebase is developed on the `feature/initial-student-hub` branch; production use remains blocked by the legal/privacy/security review gate.
