# M4 Guardian / family portal (fictional demonstration)

## Purpose
Demonstrate how a guardian could see only their own child's school progress, lesson attendance and externally paid fee status. This is an original BigChange UI flow; **not a real identity or privacy control**.

## Features
- The role preview now includes **Guardian**, with sidebar restricted to Overview and Family.
- The fictional Guardian A is explicitly linked to Learner A and Learner C for an example two-child household; Guardian B is linked only to Learner B in test fixtures.
- Switching children changes courses, per-session attendance, assignments, grades, feedback and offline fee snapshots.
- Attendance metrics count only marked Present/Absent/Late sessions; Excused and Unmarked are separately disclosed. Unmarked is not an absence.
- Grade averages consider graded tasks only, and missing submissions are tracked separately.
- Fee rows require explicit guardian ID and learner ID matching, preventing accidental display of unrelated sample ledger records. Fees are informational, not paid within the system.
- Future email/WhatsApp channel switches only update local browser state. They DO NOT collect contacts, record legally valid consent, or send anything.
- The existing Student/Teacher/Admin previews, M1 classes, M2 attendance, and M3 grades remain unchanged and feed data into the guardian demo.
- No Supabase changes. No real child/family details. No account authentication or production guardian permissions.

## Test steps
1. Open preview role menu and select **Guardian**. Only Overview and Family should show on the sidebar.
2. Check Learner A and Learner C in the child selector. Guardian A's linked learners are fictional.
3. Select **Family**: inspect course enrollments, attendance per lesson, pending homework, recorded grades, and offline fee status.
4. Select Learner C. It should have different classes, example attendance and a different unpaid ledger record.
5. Switch back to Administrator, change a sample payment in Finance for Student C, then return to Guardian; this is in-memory only.
6. Switch to Student, submit a class assignment or complete a quiz, then Teacher to grade the fictional response. Return to Guardian to see the updated result.
7. Try future notification preferences. No messages send; there are no phone/email fields.
8. Refresh and confirm local states reset. Check mobile and Chromebook layout.

## Unresolved security and legal gates
This UI filtering cannot protect school data. Before real guardian use, implement server-verified guardian–child links; least-privilege RLS on every read/write; private grade/attendance endpoints; custody/consent and access revocation workflow; verified notification recipients and opt-outs; valid local privacy review; auditing; encryption, backup and incident response.
