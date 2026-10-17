# M5.6 — Add Teacher / Add Student and People & Roles (fictional demo)

The earlier Academy preview supplied pre-seeded instructor and learner arrays but did not let an administrator create new people. This milestone supplies working in-memory creation and enrollment controls while the Supabase backend remains **paused**.

## Access model for this sample preview
| Role preview | People functions |
|---|---|
| Administrator | Add Teacher, Add Student, browse all fictional users, assign a teacher to class groups, enroll students |
| Teacher (Instructor A preview) | Browse rosters in their assigned groups, enroll an **existing** fictional student into their own group; cannot create an account or enroll in Instructor B's group |
| Student (Learner A preview) | See own classes, assignments and grades; cannot create people or enroll themselves |
| Guardian (Guardian A preview) | See previously verified **fictional** children; cannot create or self-link a child. Real guardian verification is a future backend requirement |

## Changes
- Administrator Overview now has **+ Add Teacher** and **+ Add Student** shortcuts into **People & Roles** (previous Directory).
- People & Roles adds separate, functional creation forms. Names **must** start with `Sample Teacher ` or `Sample Learner ` and must not be real personal information. Duplicate names rejected, data maintained in React memory, generated demo ID stable until refresh.
- The app now holds a single shared fictional teacher and learner directory. New sample teachers appear in assignment pickers in Classes; new students appear in enrollment pickers, rosters, attendance and grading where enrolled.
- The existing capacity, duplicate course registration, and teacher schedule-conflict rules remain enforced; newly created entries are validated against the current directory instead of only the original seed fixtures.
- Reports teacher filters and the administrator overview use the updated sample teachers.
- Teacher can use People & Roles -> Enroll existing student in one of Instructor A's visible classes. Real teacher enrollment permissions have **not** been granted.
- No contact details, actual accounts, passwords, real guardians, invitations, database rows, external notifications or financial transactions.

## Manual walkthrough
1. Open public demo. Choose **Administrator**, then **People & Roles**.
2. Use **Add Teacher**, e.g. `Sample Teacher Delta`. The new teacher appears immediately in the directory. Go to Classes and assign them to a group or create a new group.
3. Return to People & Roles. Use **Add Student**, e.g. `Sample Learner Indigo`. It appears as **Not enrolled** initially.
4. Enroll Sample Learner Indigo in Computer Foundations. Verify class count, roster, attendance and M5 Reports updates.
5. Attempt to add the same name again or exceed a class's available seats. The UI should show a validation error.
6. Switch to **Teacher**. People & Roles permits enrollment only into Instructor A's sample groups; not adding a teacher or creating student accounts.
7. Switch to **Student** and **Guardian**. Neither may create an account or arbitrarily link a child.
8. Refresh: newly created people, class assignments and enrollments reset. Do not enter real names or contact information.

## Production requirements
Before the app can actually register teachers, learners or guardians, Supabase must be resumed with authenticated role-gated server CRUD, RLS across related tables, consent/custody/guardian verification, audit logs, safe retention and backup/recovery, rate limits, staff approval flows, invitations, and legal/child-data privacy review. These UI buttons are not proof of authorization, nor a replacement for backend user provisioning.

This milestone is an independent implementation. No AGPL reference code/assets were copied.
