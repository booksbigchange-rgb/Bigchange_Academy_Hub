# BigChange Academy Hub — lesson rescheduling and assessment editing (M5.11)

This feature branch builds on M5.10. **Manual hands-on review is deliberately deferred** at the owner's request. Do not replace the public GitHub Pages preview until its eventual review.

## Frontend work included
- **Reschedule a lesson:** educator opens Lessons, selects a planned session, and edits its date alongside topic/objective. The date must fall within the existing academic term, match the class's two weekly meeting days, and not duplicate another session for that class.
- **Preserve attendance identity:** a lesson's stable session ID does not change when its date changes. Attendance rows remain linked to the same session, avoiding silent deletion or detachment of marks. This remains browser-only demo history, not a secure audit.
- **Edit assignment/quiz metadata:** teacher/admin can open an existing project or quiz and update its title, instructions, and due date within the same academic term.
- **Keep submitted work coherent:** assignment/quiz kind, class, term, quiz questions, project rubric, submissions and existing scores cannot be changed through this editor. Metadata updates preserve the same task ID and submission records.
- **Validation:** dates outside the term, class non-meeting days, duplicate session dates, invalid title/instructions, and duplicate task titles are rejected with in-page feedback.
- **Student previews remain read-only:** students see the revised sample due date and content but do not receive editing controls.
- All changes are temporary in-memory state and reset on refresh. No Supabase, real school account or student record was used.

## Review checklist — intentionally not run yet
1. In Administrator preview, open Lessons and reschedule \`session-1\` from 2026-10-19 to another Monday/Wednesday date in the same term. Confirm the same session is still selected and existing attendance remains associated.
2. Attempt a Tuesday date for the Monday/Wednesday class, a date outside the term, and a date already used by the same class. Each should be rejected.
3. In Attendance, select the moved session and confirm the attendance marks remain; check the session's new date is displayed.
4. In Assignments, edit \`task-1\` title, instructions and due date. Confirm its rubric and any sample submissions remain.
5. Attempt a due date outside the selected task's term and a duplicate title within that class/term; both should be rejected.
6. In Quizzes, edit metadata on \`task-2\`; confirm the quiz question bank remains unchanged and previously recorded responses remain attached.
7. Switch to Student preview and confirm editing controls are absent, while revised task information is visible.
8. Refresh and confirm changes reset. Do not use real names or data.


- **Admin course catalog:** create a course with 3–8 modules, edit its descriptive fields, and archive/reactivate it. Custom course IDs are passed to class groups, lesson modules, quiz generation, family views, dashboards and reports. Archiving preserves existing classes/lesson/grade history and prevents assigning the course to new groups.

## Still outstanding before calling the frontend complete
- Admin course catalog create/edit/archive and an integrated curriculum builder.
- Richer fee-plan edits, adjustment history and receipt/export flows (still fictional; no payment processing).
- Consistent real localization and a full visual, keyboard, Chromebook and mobile review.
- Actual authenticated roles, verified guardian permissions, durable storage, audit controls, backup/recovery and privacy review are a separate paused backend milestone.
