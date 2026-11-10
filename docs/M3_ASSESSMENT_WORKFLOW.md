# M3 — Assignments, Quizzes, Rubrics and Progress (fictional demonstration)

## Implemented
- Each assessment belongs to a specific M1 classroom and M2 academic term. Due date is validated against that term. Teachers may create tasks only for groups visible as Instructor A (demo role, **not** real authorization); administrators can create for any sample class.
- Student preview is the fictional Learner A. Only assigned group tasks appear. Text projects are submitted once, then can be evaluated by teacher/admin using three criteria (Correct information 4, Clear explanation 3, Completion 3 = 10 points).
- Quizzes use per-course predefined example multiple-choice questions. Students complete them once and receive an instant score. Questions and answer keys ship to the browser; this is **not secure exam delivery** or a production quiz engine.
- Teacher preview can view sample submissions for Instructor A's groups, review written responses, set criterion scores, provide feedback and revise a grade. The in-memory grade correction list shows previous/next scores but is **not** a secure audit log.
- Gradebook derives from the current class roster, current assessments and submissions. Student preview only displays Learner A; teacher view shows Instructor A groups; administrator sees all fictional group records. A percentage averages graded tasks only; missing submissions are counted separately.
- No file uploads, no live databases, no real student records, no payments or messages. Page refresh resets work.

## Manual acceptance tests
1. Administrator > Assignments: select Computer Foundations; examine "Identify computer parts", its three-criterion rubric and associated term.
2. Student > Assignments: submit a fictional response 15–800 characters; return to Teacher > Assignments; score it using the rubric and leave feedback. Change score once; view browser-only correction history.
3. Student > Grades: confirm reviewed grade and rubric score appear; Teacher > Grades: see class-level unsubmitted and graded statuses.
4. Student > Quizzes: answer three computer hardware questions and submit; see immediate sample score, then check Grades.
5. Teacher > Assignments: create new project with a due date in Oct–Dec 2026; reject duplicate title, invalid term date and too-short instructions.
6. Teacher > Quizzes: create a course-bank quiz; admin can create for a different class, teacher cannot create/edit an Instructor B group.
7. Switch classes and roles. Confirm enrolled Learner A sees only own assignments/grades and non-enrolled groups have no student tasks in Student preview.
8. Check mobile/Chromebook behavior and verify existing Classes, Lessons, Attendance, Finance still work.

## Open items before production
- A real backend must enforce teacher/class/student identity on **every** create/read/update, not merely preview UI role selection.
- Secure server-side quiz delivery and marking, attempt limit enforcement, rate limits, question versioning, grading audit, moderation and file-upload policies.
- Real due-date/local time handling, late policies, resubmissions, review workflow, student/guardian consent, retention and private feedback.
- Cross-role RLS tests and child privacy/legal review before any actual school use.
