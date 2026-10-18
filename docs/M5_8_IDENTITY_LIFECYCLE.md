# M5.8 — Select fictional teacher/student identities and manage added sample people

This is a **frontend-only** milestone; the public role selector remains a visual toy, NOT login or authorization. No Supabase changes or actual personal information should be used.

## What changed
- With **Teacher** selected, a second dropdown chooses any currently active fictional instructor. Classes, Courses, Timetable, Directory, Lessons, Attendance, Assignments, Quizzes and Grades now derive from that instructor's assigned class groups.
- With **Student** selected, a second dropdown chooses any currently active fictional learner. The selected learner's enrollments, sessions, grades, quiz/project submissions and progress are separate from other fictional learners.
- Changing identity remounts teaching/student forms to avoid carrying over unsent answers, selected tasks or lesson state.
- Administrator → People & Roles has a **Rename** form for newly created sample people. Internal IDs stay unchanged so roster references persist.
- **Deactivate** (two-click confirmation) and **Reactivate** for newly created sample people. Deactivation is blocked while teachers still own class groups or learners are still enrolled. Seeded fixtures cannot be edited or deactivated. Inactive people stay listed for transparency but cannot be selected/assigned/enrolled.
- Student/Teacher Overview counts, assigned courses and marked attendance follow the currently selected simulated person.
- Guardian A's static child links remain unchanged; no arbitrary guardian-child self-linking has been introduced.

## Step-by-step manual test
1. Administrator → People & Roles → Add Teacher `Sample Teacher Delta` and Add Student `Sample Learner Indigo`.
2. Return to Administrator → People & Roles → Edit or deactivate an added fictional person. Rename the new teacher to `Sample Teacher Echo` and verify the same internal ID.
3. In Classes assign Sample Teacher Echo to class-2 (Creative Design). Enroll Sample Learner Indigo into class-2.
4. Select Teacher → Fictional teacher identity → Sample Teacher Echo. Classes and Lessons must show only class-2; Instructor A's classes must not appear. Teacher may review only class-2 student submissions.
5. Select Student → Fictional student identity → Sample Learner Indigo. Classes and Courses should show Creative Design; Assignments should show the poster project. Submitting should record a separate result from Learner A.
6. Administrator → People & Roles → attempt to deactivate either sample person while assigned/enrolled; get a blocked message.
7. Unassign the teacher from all classes, remove sample learner enrollment(s) in Classes; retry deactivation and then Reactivate. Verify inactive people disappear from preview identity and assignment dropdowns.
8. Refresh; all changes revert to seeded sample fixtures. Guardian A shows only its original pre-linked fictional children.

## Limits and release blockers
- Newly created people **still have no accounts**, passwords, MFA, real invitations, or persistent records. Selecting a preview identity is not authenticating as that user; it grants no secure rights.
- Edit/deactivate is in-memory UI lifecycle only. There are no verified status/revocation events, compliance-grade audit logs, real custody/guardian processes, or secure back-end enforcement.
- These changes require manual cross-browser/mobile visual testing before merging. Full secure RLS, data minimization, legal child-protection review and scale testing remain in paused M6/M7.
