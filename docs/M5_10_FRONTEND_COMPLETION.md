# BigChange Academy Hub — Frontend completion sprint (M5.10)

This release continues from M5.9 on the **fictional demo** branch. No real school account, learner record, financial charge, or Supabase connection has been created.

## Implemented
- **Class editing:** Administrator can correct an existing teacher, weekly schedule, or seat limit in Classes without erasing enrollments. Validation rejects teacher double-booking, student schedule collisions, reduced capacity below roster, and changes that would invalidate already planned lesson weekdays.
- **Student transfers:** Move a fictional learner atomically between groups of the *same course*. Rejection due to duplicate enrollment, class capacity, source membership, or schedule conflict never removes the original roster entry.
- **Directory search:** Teacher and Administrator may search available fictional student names and identifiers. Administrator may filter active, inactive, or currently unenrolled sample people.
- **Fictional guardian administration:** Administrator gets a Guardians page for adding synthetic `Sample Guardian ...` people, linking and unlinking explicitly fictional children, and deactivating/reactivating newly added guardian profiles. Seed guardian relationships cannot be rewritten in this preview. No real identity/custody verification takes place.
- **Guardian identity selector:** Switch between fictional Guardian A, B, and newly added active guardian profiles. Guardian view draws data from that selected synthetic relationship. Empty accounts get a clear no-linked-learners message.
- React state remains temporary; all changes reset on refresh.

## Manual review instructions
1. Administrator > Classes: edit class-1 capacity 10→5 and instructor A→B. Confirm roster and lesson history remain.
2. Attempt class-1 Mon+Wed to Tue+Thu; existing class-1 Monday/Wednesday lesson sessions must block the change.
3. Create a second **Computer Foundations** group with a different instructor/time slot. Transfer Learner A from class-1 to the new group. Confirm both rosters update; transfer to Creative Design must be rejected.
4. Administrator > People & Roles: search for Learner A by name, switch filter to active and then unenrolled.
5. Administrator > Guardians: add `Sample Guardian Delta`; link fictional Learner B. Open Guardian role and select Sample Guardian Delta; check only Learner B's classes, attendance and assignments show.
6. Attempt to deactivate guardian before unlinking Learner B; it must refuse. Unlink, deactivate, and verify the profile vanishes from active guardian preview choices.
7. Verify Teacher and Student role navigation do **not** show Guardians; the guardian selection and child link are just a fake role preview, not a privacy mechanism.
8. Test at Chromebook-size 1366×768 and smaller mobile viewports, with keyboard navigation, forms, and tables. No live account should be entered.
9. Refresh: verify fictional edits and people disappear; the adult `pilot.html` remains unaffected.

## Important unresolved frontend / release work
- Admin course-catalog creation (currently fixed 5 examples), a production-style curriculum builder, editable rescheduling of individual lesson dates, deeper task editing, formal fee-plan creation and receipts, actual localization, and full design/device QA.
- Enrollment history and payment charts require real durable timestamps; never invent time-series data.
- Production launch requires a secure backend with actual authentication, server-authorized role policies, verified guardianship, secure finance audit, privacy review, accessibility and scale testing.
- No claim is made of real-browser visual test coverage solely from GitHub Actions tests.
