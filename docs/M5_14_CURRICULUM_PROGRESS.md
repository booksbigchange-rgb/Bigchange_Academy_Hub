# BigChange Academy Hub — curriculum sequence and delivery progress (M5.14)

This milestone adds a browser-only way to track whether planned lessons have been completed and see progress through the selected course syllabus. All identities, lessons and progress remain fictional; refresh resets the prototype.

## Included
- New lesson sessions retain a course-module label separate from the editable lesson title.
- Teachers and administrators can mark a planned lesson completed or reopen it.
- Students can see lesson delivery status without controls to change it.
- The module sequence follows the current course syllabus order and summarizes planned/completed sessions for the selected class and term.
- Completion updates preserve stable session IDs and do not rewrite attendance marks.
- Module progress is derived from current in-memory lessons; it is not a verified academic record or server audit.

## Manual acceptance checklist — not run
1. Open Lessons and select a fictional class and term.
2. Confirm the module list follows the course syllabus order and unplanned modules show as not planned.
3. Mark a planned lesson completed; confirm the lesson status and module progress update.
4. Reopen the lesson; confirm it returns to planned and progress recalculates.
5. Change the lesson title and confirm its selected module association remains.
6. Switch class or term; confirm progress reflects only that class and term.
7. Change to Student preview; confirm progress is visible but the completion control is absent.
8. Open Attendance and confirm completion status changes do not remove or move attendance marks.
9. Refresh and confirm all changes reset.

## Boundaries
- No database persistence, authentication, server authorization, notifications or production records.
- If a course module is renamed or reordered in the catalog, old module labels are historical strings; review them during the later curriculum migration.
- Keep the public Pages demo and Supabase pilot unchanged until the owner explicitly approves review and deployment.
