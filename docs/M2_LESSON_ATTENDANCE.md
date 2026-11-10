# M2 Classroom academic planning — teacher / administrator demonstration

**Implemented independently**, using only fake names. Based on M1 class groups; does not include a live database, real permissions, real school records or actual notifications.

## Demonstrated
1. Term catalogue: two fictional 3-month terms; administrators can create a new sample term when dates do not overlap and span 28–125 days.
2. Lessons are attached to specific classes AND terms AND calendar dates; dates must match the group's existing two-weekly-meeting-day timetable, fall inside the selected term, and be unique per classroom/day.
3. Fictional sample syllabus modules per course (e.g. Computer Foundations); a teacher/admin may add a lesson and edit its title and learning objective, but the currently enrolled learner demo may only view.
4. Attendance scoped by session and learner, with Present/Absent/Late/Excused status, counts for marked and unmarked entries, and an in-browser view of recent corrections (before/after). A student preview is restricted to Learner A's mark.
5. The timetable and enrollment from M1 remain the source of group membership; edits to enrollment dynamically update attendance roster. Historical attendance corrections are not persisted or verified.
6. All client role views are purely illustrative. Real teacher-to-class, guardian-to-learner, record permissions and audit integrity require future backend/RLS work.

## Reviewer checklist
- [ ] Admin > Lessons > choose Computer Foundations / Oct–Dec 2026; view 19 October and 21 October sessions
- [ ] Edit objective for first lesson; switch lesson and back; see updated text in memory
- [ ] Create a new lesson for 26 October (Monday), and reject an invalid Tuesday, duplicate 19 October, out-of-term date and invalid topic
- [ ] Create third sample term Apr–Jun 2027; reject overlapping and impossibly short term
- [ ] Admin or Teacher > Attendance > Computer Foundations > 19 October: change Learner A from Present to Absent, inspect correction history; switch to 21 October to confirm separate marks
- [ ] Student role > Lessons and Attendance: confirm only Learner A's visible lessons and attendance, no edit controls
- [ ] Teacher role: assigned Instructor A sessions only; no operations on Instructor B class
- [ ] Return to Classes and change enrollment; new fictional learner appears in that class's lesson register
- [ ] Refresh to clear simulated edits; confirm existing Courses, Assignments and Finance pages unaffected
- [ ] Validate layout on Chromebook/mobile

## Security and boundaries
No credentials, child contact details, payments, server rows or messages are processed. In-browser correction history is **not** an immutable audit. Teacher preview is **not** an authorization mechanism. Do not treat successful UI role filtering as proof that a real user cannot access others' data.
