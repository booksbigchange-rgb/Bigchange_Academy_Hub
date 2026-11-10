# M5.9 — Class scheduling consistency and truthful overview copy

This milestone fixes a school-operations issue in the **fictional, temporary demo**. It does not enable actual teacher/student registration, authentication, secure authorization, or Supabase.

## Verified problems and fixes
1. **Student timetable collisions**: a learner could previously enroll in two different course groups with the exact same two-day/week time slot. The model now rejects double booking across courses as well as duplicate enrollment in the same course and class-capacity overflow. A class meeting on the same days at **different times** is still allowed.
2. **Incorrect class suggestion for every role**: the Overview previously claimed the next class was Computer Foundations and pushed a digital-poster project, even when Teacher B or a newly added student had different/no classes. The home highlight now displays the selected fictional identity's first scheduled class group and one related practice idea; **it does not invent a dated upcoming lesson**.
3. **Inactive teacher reporting**: the administrator's Reports selector now receives the active roster of fictional teachers instead of showing deactivated identities as though they were assignable.

## Manual acceptance steps
1. In Administrator → People & Roles, create `Sample Teacher Delta`; in Classes, create an AI & Automation group with **Mon + Wed · 16:00** taught by the new teacher. Teacher A's Computer Foundations class already uses that slot, but creating a different teacher's group is allowed.
2. Try to enroll **Learner A** in the new group. The app should reject the attempt with a weekly time-conflict message, while preserving the original enrollment.
3. Try Learner A in Scratch Studio (**Mon + Wed · 10:00**) instead. The different start time should be allowed.
4. Select **Teacher → Instructor B**. Overview's class highlight should show **Creative Design · CLASS-2, Tue + Thu · 16:00**, not Computer Foundations.
5. Select **Student → Learner P** (unenrolled). Overview should say there are no assigned groups, rather than inventing an upcoming class.
6. Test on Chromebook-size and narrow mobile viewports. Confirm the existing Add Teacher/Add Student, review/grade and guardian workflows remain usable. Refresh resets all fictitious changes.

## Remaining work
- School administrators might wish to detect *travel time* and partial-hour overlaps, but the demo has only four discrete, fixed slots. Matching time-slot strings is sufficient for the sample; it is NOT a real timetabling algorithm.
- The overview highlight is based on the first listed group, not today's true calendar or real-time availability.
- Actual school records require authenticated identity, least-privilege server permissions, real persistence, audit logging, verified guardian-child links, data-retention/privacy review, and scale/device testing. All backend work remains paused at M6.
- CI tests are not a physical Chromebook or visual browser test.
