# BigChange Academy Hub — course catalog administration (M5.12)

Manual testing is deferred at the owner's request. This checklist is documentation for later; do not treat it as executed.

## Included
- Administrator can create, edit and archive/reactivate courses in the Courses page.
- Course metadata includes name, description, practice activity and 3–8 syllabus modules.
- Course names and modules are validated for length and duplicates.
- New courses get stable synthetic IDs and a generic multiple-choice question bank for the demo.
- New active courses appear in class creation. Their names flow into lessons, quizzes, guardian views, dashboards and reports.
- Editing preserves the existing course ID so class groups, sessions, assignments and grades remain associated.
- Archiving does not delete existing records and allows current groups to remain visible. It blocks assigning the course to new groups. At least one active course must remain.
- Browser state is temporary; refresh resets changes. This is not an authenticated or persistent school catalog.

## Review checklist — not run
1. Administrator > Courses: create a sample course with four modules and a practice activity.
2. Open Classes and create a group using the new course; confirm it appears with the selected course name.
3. Open Lessons; confirm the custom syllabus modules appear in the course-module selector.
4. Open Assignments and Quizzes; confirm assessments can be created for the custom course's group.
5. Open Reports and Guardian preview; confirm course labels remain accurate.
6. Edit the course name and module list; confirm existing groups and lesson/assessment records still use the same course ID.
7. Archive the course; confirm it disappears from new-class choices but remains visible for existing classes and reports.
8. Reactivate the course and confirm it returns to new-class choices.
9. Attempt duplicate course names, fewer than three modules, duplicate modules, and archiving the last active course; each should be rejected.
10. Refresh and confirm all changes reset. Do not enter real school data.

## Not included
- Full curriculum sequencing/calendar builder, actual localization, permanent data, backend authorization, or verified school records.
