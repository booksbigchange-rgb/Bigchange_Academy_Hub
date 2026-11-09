# Questions for the owner

## Answers received (2026-11-09) and what was built
- **Q1:** payment is due at the **end**; a family becomes **Overdue 14 days after** their 3 months end. *Built (migration 0005).*
- **Q2:** one course per subject, level in the class name, e.g. **"English – Level 2"**. *No build needed.*
- **Q3:** not yet understood — asked again in simpler words.
- **Q4:** **Send on WhatsApp** for teachers (their own students' parents) and finance; finance gets a list of everyone to remind plus "copy numbers" for a WhatsApp broadcast list; **date of each reminder recorded**. Teachers already use WhatsApp groups with parents and send Zoom links there. *Built (migration 0005 + screens).*
- **Q5:** yes to weekly backups and a second admin. *Backup script and steps: `docs/BACKUPS.md`.*

---


**How to answer:** reply with one short line per question, for example:
`Q1: start, 14 days · Q2: A · Q3: A · Q4: B, finance/admin only, school phone, yes · Q5: weekly copy by <name>, second admin = <name>`

Nothing below is decided yet. "Our suggestion" is only a suggestion.

**How payments work in the app today:** each family pays once every 3 months for all their children's courses: **150 USD** if the family has one course in total, or **100 USD per course** if they have two or more. Each family has its own dates (for example **10 August 2026 to 10 November 2026**). On the day finance starts a family's 3 months, the app works out the amount from the courses the children are in that day, and it does not change after that. A form teacher reports when a parent pays, finance checks it, and the admin approves it. Money is paid to the school directly, never through the app.

---

## Do these before real families use the app

### Q5. Backups and a second admin (asked first because it is urgent)
- **Backups:** Supabase (the service that stores the app's data) keeps only a few days of copies on the free plan. Choose one:
  - **Weekly copy** (free): a named staff member downloads a copy of the data every week (about 10 minutes; we will write the steps). The copy contains families' names and phone numbers, so keep it somewhere safe and private (for example a school computer or a school Google Drive), not on a personal phone. Tell us who will do it.
  - **Paid plan**: automatic daily copies (check the current price on supabase.com).
- **Second admin:** name one more trusted person who should have full admin access, in case you lose your phone or password.

**Our suggestion:** weekly copy now, and a second admin.

---

## Please answer

### Q1. When is the payment due: at the **start** or at the **end** of the 3 months?
Today the app marks a family **Overdue** only after their 3 months have **ended** without an approved payment. If parents are supposed to pay at the **start**, the app should mark them overdue earlier (for example after the first 2 weeks).
- **start**: overdue if not paid within a number of days after the start (tell us how many days, e.g. 14)
- **end**: keep today's rule

### Q2. Course levels
In the app, a **course** is the subject (for example English) and a **class** is one group of students with a teacher and a time. Students also have a school **grade** (Grade 5–10); that is something different and stays as it is.

Today the app has no special place for a level; staff type it into the course or class name. If you have already created separate courses for each level (for example "English Level 1" and "English Level 2"), those need to be merged into one "English" course when you choose A or B; we can help with that.

| Option | What it means | Time to build |
|---|---|---|
| **A. One course per subject, level in the class name** | Make one course "English", and name each class with one fixed pattern, e.g. **"English – Level 2"**, **"Computer – Canva"**. Fees count correctly (English is one course, whatever the level). | None |
| **B. A level drop-down on each class** | Like A, but the level is picked from a list instead of typed, and you can list students by level. | About 2–3 days |
| *(Don't do this)* One course per level | Making "English Level 1" and "English Level 2" separate courses would charge a student twice if they are ever in both. | – |

**Our suggestion: A.** It costs nothing and is enough while each level has one class. Choose B later if you run several classes of the same level at the same time.
When moving a student up a level: **enroll them in the new class first, then remove them from the old one**, so the fee count never drops by mistake.

### Q3. A child or course added in the middle of a family's 3 months
**Today:** nothing extra is charged for the rest of the 3 months; the new course counts from the family's **next** 3 months.
Example: a family pays 150 for one course. A sister joins another course halfway through. The family would now pay 200 (2 × 100). Under today's rule they keep paying 150 until their next 3 months, so the school misses **50 USD** for that period. If a family that already has two courses (200) adds a third (300), the school misses **100 USD**, and 100 more for each further course. (A completely new family is not affected; they start their own 3 months on the day they join.)

The same rule works the other way: a child who **leaves** or drops a course gets **no refund**; the family pays less from the next 3 months.

| Option | What it means | Time to build |
|---|---|---|
| **A. Count from the next 3 months** (today) | As above. If you want, ask the parent for a top-up in person; the person reporting the payment (form teacher or finance) can mention it in the payment's note. | None |
| **B. Admin can correct the amount** | Admin can change the current 3 months' amount up or down, with a reason that is saved. Handles joiners and leavers. | About 1–2 days |

**Our suggestion: A.**

### Q4. Payment reminders
**Today:** on an overdue family, staff (finance or admin) press **Copy reminder** and paste the text into their own WhatsApp or email. The app shows whether the parent agreed to be contacted, but it only warns; it does not stop staff sending.

| Option | What it means | Money | Time to build |
|---|---|---|---|
| **A. Copy and paste** (today) | As above. | None | – |
| **B. "Send on WhatsApp" button** | Opens WhatsApp with the parent's number and the reminder already written; staff check it and press send. Shown only if the parent agreed to WhatsApp. | None | About 2 days |

Later, if needed: the app could email many parents at once (needs an email service, free for small numbers, and a school email address such as fees@yourschool), or send WhatsApp messages by itself (WhatsApp charges for each message and has to approve each message text first).

**If you choose B, also tell us:**
- Who sends: **only finance/admin**, or **teachers too**?
- From which phone: a **school phone**, or **staff's own phones**? (Using personal phones shows staff numbers to parents and keeps parents' numbers on personal phones.)
- Should the app note **the date each reminder was sent** (so nobody reminds the same parent twice)? We suggest **yes**.

**Our suggestion: B, sent by finance/admin from a school phone, with the date noted.**

---

## For the developer (not needed to answer)

Notes from the review (`egm` design, scope, comprehension and implementation-readiness reviewers, 2026-11-09):

- **Payment amounts are not stored**, only unpaid / partly paid / paid (`academy_fee_periods`, migration 0003). Any option that credits or pro-rates money needs an amount-paid field first. `period_end`/`amount_due` are locked by `academy_period_guard`; an amount correction (Q3 B) needs an admin-only, audited RPC exempt from the guard.
- **Q1 "start":** change `academy_period_state` to mark overdue `period_start + grace` when not approved as paid; reminders then appear earlier (`LiveFees.tsx` shows them for `overdue`).
- **Next period** is not started automatically; finance starts it (it may start on the previous `period_end`). Consider an "ended, no next period" filter.
- **Q2 B data model:** `academy_course_levels(course_id, label, sort_order)` + `academy_classes.level_id`, trigger that the level belongs to the class's course; admin-only writes. Name it "Level / stage" in the UI to avoid confusion with learner `grade_level`. Enrollments have no dates; level history is lost on unenroll unless start/end dates are added.
- **Consent gap (fix regardless of Q4):** `academy_add_guardian` ignores opt-in flags when it reuses an existing parent, and there is no screen to change consent. Add an admin-only, audited `academy_set_guardian_consent` RPC and a control on the Guardians screen; withdrawing consent takes effect immediately. Add DB checks `whatsapp_opt_in ⇒ phone_e164 not null`, `email_opt_in ⇒ email not null` (clean existing rows first).
- **Q4 B:** `whatsappLink(phoneE164, text)` → `https://wa.me/<digits>?text=<encoded>`, shown only when overdue, opted in and phone present. If teachers send, `academy_teacher_fee_periods()` must return `whatsapp_opt_in` (drop and recreate; verified links only); teachers' reminder text lists only their own students. "Date sent" needs `academy_reminder_events(period_id, staff_id, channel, opened_at)` written via an RPC with the same permission check as `academy_report_payment`.
- **Tests to add:** mid-period sibling keeps the fixed amount (`200.00`) while `academy_family_fee` shows the new count; learner in two classes of one course counts once; consent RPC admin-only; reminder log refused for unrelated teachers.
