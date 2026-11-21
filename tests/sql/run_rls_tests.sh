#!/usr/bin/env bash
# Local RLS isolation test. Usage: tests/sql/run_rls_tests.sh <psql connection args>, e.g. -h /var/tmp/pgtest -p 5544 -U postgres
# Requires a database with the auth stubs, all migrations applied, and an empty seed target.
# Easiest: tests/sql/run_local.sh sets all of that up on a throwaway PostgreSQL and calls this script.
set -u
PSQL="psql $* -At -v ON_ERROR_STOP=0"
DIR="$(cd "$(dirname "$0")" && pwd)"
$PSQL -q -f "$DIR/rls_seed.sql" >/dev/null 2>&1 || { echo "seed failed"; exit 2; }
A=00000000-0000-0000-0000-0000000000a1; TA=00000000-0000-0000-0000-0000000000b1; TB=00000000-0000-0000-0000-0000000000b2
F=00000000-0000-0000-0000-0000000000c1; L1=00000000-0000-0000-0000-0000000000d1; G1=00000000-0000-0000-0000-0000000000e1
fail=0; pass=0
chk(){ # name, role(sub|anon), sql, expected (exact output, or ERR for any error)
  local name="$1" who="$2" sql="$3" want="$4" out pre="set role authenticated; select set_config('request.sub','$2',false);"
  [ "$who" = anon ] && pre="set role anon;"
  out=$($PSQL -c "$pre $sql" 2>&1 | grep -v '^set_config\|^SET$\|^[0-9a-f-]\{36\}$\|^$' | tr '\n' ' ' | sed 's/ *$//')
  if [ "$want" = ERR ]; then echo "$out" | grep -q -i "error\|violates" && ok=1 || ok=0
  else [ "$out" = "$want" ] && ok=1 || ok=0; fi
  if [ $ok = 1 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $name -> got [$out] want [$want]"; fi
}
chk "anon cannot read learners" anon "select count(*) from academy_learners" ERR
chk "teacherA sees only own class learner" $TA "select count(*) from academy_learners" 1
chk "teacherA sees only own class" $TA "select count(*) from academy_classes" 1
chk "teacherA cannot see guardians" $TA "select count(*) from academy_guardians" 0
chk "learner sees only self" $L1 "select count(*) from academy_learners" 1
chk "guardian sees only own child" $G1 "select count(*) from academy_learners" 1
chk "admin sees both learners" $A "select count(*) from academy_learners" 2
chk "finance cannot change classes" $F "update academy_classes set title='x'" "UPDATE 0"
chk "teacherA records attendance in own class" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','present','10000000-0000-0000-0000-0000000000b1')" "INSERT 0 1"
chk "duplicate attendance is rejected" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','absent','10000000-0000-0000-0000-0000000000b1')" ERR
chk "teacherA cannot record in other class" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002','present','10000000-0000-0000-0000-0000000000b1')" ERR
chk "teacherB cannot record learner not enrolled in class" $TB "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','present','10000000-0000-0000-0000-0000000000b2')" ERR
chk "attendance cannot be attributed to another staff" $TB "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002','present','10000000-0000-0000-0000-0000000000a1')" ERR
chk "learner cannot edit attendance" $L1 "update academy_attendance set status='present'" "UPDATE 0"
chk "guardian sees own child's attendance" $G1 "select count(*) from academy_attendance" 1
chk "teacherB cannot see teacherA attendance" $TB "select count(*) from academy_attendance" 0
chk "audit visible to admin only" $F "select count(*) from academy_audit_events" 0
chk "audit rows cannot be altered by admin" $A "update academy_audit_events set action='x'" ERR
chk "teacher cannot enroll" $TA "insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002')" ERR
chk "teacher cannot change own role" $TA "update academy_staff set role='admin'" ERR
[ -n "${VERBOSE:-}" ] && true
chk "teacherA adds guardian for own student" $TA "select count(*) from (select academy_add_guardian('20000000-0000-0000-0000-000000000001','Sample Parent','new@example.com','+251911000000',true,false)) x" 1
chk "teacher cannot add guardian for another teacher's student" $TB "select academy_add_guardian('20000000-0000-0000-0000-000000000001','Sample Parent','x@example.com',null,false,false)" ERR
chk "finance cannot add guardians" $F "select academy_add_guardian('20000000-0000-0000-0000-000000000001','Sample Parent','y@example.com',null,false,false)" ERR
chk "invalid phone rejected" $TA "select academy_add_guardian('20000000-0000-0000-0000-000000000001','Sample Parent',null,'0911',false,false)" ERR
chk "contact required" $TA "select academy_add_guardian('20000000-0000-0000-0000-000000000001','Sample Parent',null,null,false,false)" ERR
chk "teacher-added link is unverified" $TA "select count(*) from academy_guardians_for_learner('20000000-0000-0000-0000-000000000001') where not verified" 1
chk "teacher sees no email/phone/name for a pending link" $TA "select count(*) from academy_guardians_for_learner('20000000-0000-0000-0000-000000000001') where not verified and (email is not null or phone_e164 is not null or display_name <> 'Parent (waiting for verification)')" 0
chk "admin still sees pending contact details" $A "select count(*) from academy_guardians_for_learner('20000000-0000-0000-0000-000000000001') where not verified and email is not null" 1
chk "teacher sees no contacts for another teacher's student" $TB "select count(*) from academy_guardians_for_learner('20000000-0000-0000-0000-000000000001')" 0
chk "teacher cannot read guardians table" $TA "select count(*) from academy_guardians" 0
chk "same email reuses the guardian (siblings)" $A "select count(*) from (select academy_add_guardian('20000000-0000-0000-0000-000000000002','Sample Parent','NEW@example.com',null,false,false)) x" 1
chk "no duplicate guardian was created" $A "select count(*) from academy_guardians where lower(email)='new@example.com'" 1
chk "audit has fee, attendance and guardian events" $A "select count(distinct entity_type)>=3 from academy_audit_events" t
G1ID=30000000-0000-0000-0000-000000000001; G2ID=30000000-0000-0000-0000-000000000002; E2=00000000-0000-0000-0000-0000000000e2
PRD="(select period_id from academy_teacher_fee_periods() where guardian_id='$G1ID')"
chk "family fee counts courses per child, once per course (2 courses -> 200)" $F "select course_count||'/'||amount_due from academy_family_fee('$G1ID')" "2/200"
chk "one course -> 150" $F "select course_count||'/'||amount_due from academy_family_fee('$G2ID')" "1/150"
chk "teacher cannot compute family fees" $TA "select * from academy_family_fee('$G1ID')" ERR
chk "teacher cannot create a family-wide period" $TA "select academy_create_fee_period('$G1ID', current_date)" ERR
# Family-wide periods are retired (migration 0008); older ones still exist, so seed them as the table owner.
$PSQL -q -c "insert into academy_fee_periods(guardian_id,period_start,period_end,course_count,amount_due,created_by_staff_id) values ('$G1ID',current_date - 40,(current_date - 40 + interval '3 months')::date,2,200,'10000000-0000-0000-0000-0000000000c1')" >/dev/null
chk "family-wide periods are retired, even for finance" $F "select academy_create_fee_period('$G1ID', current_date + 200)" ERR
P1=$($PSQL -c "select id from academy_fee_periods where guardian_id='$G1ID'" 2>/dev/null)
$PSQL -q -c "insert into academy_fee_periods(guardian_id,period_start,period_end,course_count,amount_due,created_by_staff_id) values ('$G2ID',date '2024-01-01',(date '2024-01-01' + interval '3 months')::date,1,150,'10000000-0000-0000-0000-0000000000c1')" >/dev/null
chk "period is USD with computed amount" $F "select currency_code||amount_due from academy_fee_period_status where guardian_id='$G1ID'" "USD200.00"
chk "ended unapproved period is overdue" $F "select status from academy_fee_period_status where guardian_id='$G2ID'" overdue
chk "current unpaid period is unpaid" $F "select status from academy_fee_period_status where guardian_id='$G1ID'" unpaid
chk "teacher sees the parent's period with phone" $TA "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 1
chk "teacher of another parent's child sees nothing" $TB "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 0
chk "unrelated teacher cannot report" $TB "select academy_report_payment('$P1', 'paid', current_date, 'israel', null, null)" ERR
chk "report needs a date" $TA "select academy_report_payment($PRD, 'paid', null, 'israel', null, null)" ERR
chk "report cannot be future-dated" $TA "select academy_report_payment($PRD, 'paid', current_date + 2, 'israel', null, null)" ERR
chk "report needs a method" $TA "select academy_report_payment($PRD, 'paid', current_date, null, null, null)" ERR
chk "report rejects markup in note" $TA "select academy_report_payment($PRD, 'paid', current_date, 'israel', '<b>x</b>', null)" ERR
chk "form teacher reports a payment" $TA "select academy_report_payment($PRD, 'paid', current_date - 3, 'habesha_shop', 'Receipt 123', null)" ""
chk "report is stage 'reported' and still not effective" $TA "select stage||'/'||status from academy_teacher_fee_periods() where guardian_id='$G1ID'" "reported/unpaid"
chk "teacher cannot edit the table directly" $TA "update academy_fee_periods set approved_status='paid'" "UPDATE 0"
chk "finance sees date, method and note" $F "select paid_on=current_date-3 and paid_method='habesha_shop' and paid_note='Receipt 123' from academy_fee_period_status where guardian_id='$G1ID'" t
chk "admin cannot approve before finance checks" $A "update academy_fee_periods set approved_status='paid' where guardian_id='$G1ID'" ERR
chk "finance cannot check something not reported" $F "update academy_fee_periods set checked_status='partial' where guardian_id='$G1ID'" ERR
chk "finance checks what was reported" $F "update academy_fee_periods set checked_status='paid' where guardian_id='$G1ID'" "UPDATE 1"
chk "finance cannot approve" $F "update academy_fee_periods set approved_status='paid' where guardian_id='$G1ID'" ERR
chk "finance cannot change the amount" $F "update academy_fee_periods set amount_due=1 where guardian_id='$G1ID'" ERR
chk "admin approves what finance checked" $A "update academy_fee_periods set approved_status='paid' where guardian_id='$G1ID'" "UPDATE 1"
chk "approved paid is effective" $F "select status from academy_fee_period_status where guardian_id='$G1ID'" paid
chk "teacher now sees approved paid" $TA "select stage||'/'||status from academy_teacher_fee_periods() where guardian_id='$G1ID'" "approved/paid"
chk "guardian sees own approved status only" $G1 "select status from academy_fee_period_status" paid
chk "other guardian sees only own period" $E2 "select count(*) from academy_fee_period_status" 1
chk "learner has no fee data" $L1 "select count(*) from academy_teacher_fee_periods()" 0
chk "teacher changing the report resets check and approval" $TA "select academy_report_payment($PRD, 'partial', current_date - 1, 'israel', null, null)" ""
chk "approval was reset to unpaid" $A "select approved_status||'/'||checked_status from academy_fee_periods where guardian_id='$G1ID'" "unpaid/unpaid"
chk "status after reset is unpaid again" $F "select status from academy_fee_period_status where guardian_id='$G1ID'" unpaid
$PSQL -q -c "insert into academy_fee_periods(guardian_id,period_start,period_end,course_count,amount_due,created_by_staff_id) values ('$G2ID',(current_date - interval '3 months' - interval '5 days')::date,((current_date - interval '3 months' - interval '5 days')::date + interval '3 months')::date,1,150,'10000000-0000-0000-0000-0000000000c1')" >/dev/null
chk "period ended 5 days ago is NOT yet overdue (14-day grace)" $F "select status from academy_fee_period_status where guardian_id='$G2ID' and period_start > date '2025-01-01'" unpaid
chk "the 2024 period (long past the grace) is overdue" $F "select status from academy_fee_period_status where guardian_id='$G2ID' and period_start = date '2024-01-01'" overdue
chk "WhatsApp reminder refused without the parent's permission" $TA "select academy_log_reminder($PRD, 'whatsapp')" ERR
chk "copied reminder allowed without WhatsApp permission" $TA "select academy_log_reminder($PRD, 'copied') is not null" t
chk "WhatsApp permission needs a phone number" $TA "select academy_set_guardian_consent('$G1ID', false, true)" ERR
chk "admin adds the parent's phone" $A "update academy_guardians set phone_e164='+251922000000' where id='$G1ID'" "UPDATE 1"
chk "teacher of the child records WhatsApp permission" $TA "select academy_set_guardian_consent('$G1ID', false, true)" ""
chk "unrelated teacher cannot change permission" $TB "select academy_set_guardian_consent('$G1ID', false, false)" ERR
chk "finance cannot change permission" $F "select academy_set_guardian_consent('$G1ID', false, false)" ERR
chk "teacher sends a WhatsApp reminder and it is recorded" $TA "select academy_log_reminder($PRD, 'whatsapp') is not null" t
chk "teacher sees the WhatsApp permission and last reminder date" $TA "select whatsapp_opt_in and last_reminded_at is not null from academy_teacher_fee_periods() where guardian_id='$G1ID'" t
chk "unrelated teacher cannot log a reminder" $TB "select academy_log_reminder('$P1', 'whatsapp')" ERR
chk "finance sees the reminder log" $F "select count(*) from academy_reminder_events where guardian_id='$G1ID'" 2
chk "teacher cannot read the reminder log table" $TA "select count(*) from academy_reminder_events" 0
chk "nobody can write the reminder log directly" $A "insert into academy_reminder_events(period_id,guardian_id,staff_id,channel) select id, guardian_id, '10000000-0000-0000-0000-0000000000a1', 'whatsapp' from academy_fee_periods limit 1" ERR
chk "permission change is audited" $A "select count(*) from academy_audit_events where action='SET_CONSENT'" 1
chk "consent without contact is blocked by the database" $A "update academy_guardians set phone_e164=null where id='$G1ID'" ERR
chk "anon cannot call fee RPC" anon "select count(*) from academy_teacher_fee_periods()" ERR
chk "no direct inserts into periods" $F "insert into academy_fee_periods(guardian_id,period_start,period_end,course_count,amount_due) values ('$G1ID','2030-01-01','2030-04-01',1,150)" ERR
chk "finance can read enrollments" $F "select count(*)>=2 from academy_enrollments" t
chk "admin adds a sibling in teacher B's class under the same parent" $A "insert into academy_learners(id,display_name) values ('20000000-0000-0000-0000-000000000003','Sample Learner 3'); insert into academy_guardian_links values ('20000000-0000-0000-0000-000000000003','$G1ID','10000000-0000-0000-0000-0000000000a1'); insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000003')" "INSERT 0 1 INSERT 0 1 INSERT 0 1"
chk "every teacher of the parent's children sees the same record" $TB "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 1
chk "teacher B sees only own student's name" $TB "select students::text from academy_teacher_fee_periods() where guardian_id='$G1ID'" '{"Sample Learner 3"}'
chk "teacher B can report for the same parent" $TB "select academy_report_payment($PRD, 'paid', current_date - 1, 'website', null, null)" ""
chk "teacher A sees teacher B's report" $TA "select reported_status||'/'||paid_method from academy_teacher_fee_periods() where guardian_id='$G1ID'" "paid/website"
chk "same phone reuses the guardian (parent tracked by number)" $A "select count(*) from (select academy_add_guardian('20000000-0000-0000-0000-000000000003','Another Name',null,'+251911000000',false,false)) x" 1
chk "one guardian per phone number" $A "select count(*) from academy_guardians where phone_e164='+251911000000'" 1
CP="(select id from academy_fee_period_status where learner_id='20000000-0000-0000-0000-000000000003')"
chk "child fee: sister's own courses at the family rate (1 course, family has 3 → 100)" $F "select child_courses||'/'||family_courses||'/'||amount_due from academy_child_fee('20000000-0000-0000-0000-000000000003')" "1/3/100"
chk "teacher cannot compute a child fee" $TA "select * from academy_child_fee('20000000-0000-0000-0000-000000000003')" ERR
chk "finance starts the sister's own 3 months from her start day" $F "select count(*) from (select academy_create_child_period('20000000-0000-0000-0000-000000000003', current_date)) x" 1
chk "overlapping period for the same child refused" $F "select academy_create_child_period('20000000-0000-0000-0000-000000000003', current_date + 30)" ERR
chk "teacher cannot start a child period" $TA "select academy_create_child_period('20000000-0000-0000-0000-000000000003', current_date + 200)" ERR
chk "child period is separate from the family period" $F "select count(*) from academy_fee_period_status where guardian_id='$G1ID'" 2
chk "child period shows that child to her own teacher" $TB "select students::text from academy_teacher_fee_periods() where period_start = current_date and guardian_id='$G1ID'" '{"Sample Learner 3"}'
chk "the sibling's teacher sees the record but not the other child's name" $TA "select students::text from academy_teacher_fee_periods() where period_start = current_date and guardian_id='$G1ID'" '{}'
chk "admin changes an amount with a reason" $A "select academy_set_period_amount($CP, 90, 'Agreed discount for second child')" ""
chk "the new amount is stored" $F "select amount_due from academy_fee_period_status where learner_id='20000000-0000-0000-0000-000000000003'" "90.00"
chk "the change is audited with old and new amount" $A "select (detail->>'from')||'>'||(detail->>'to') from academy_audit_events where action='CHANGE_AMOUNT'" "100.00>90.00"
chk "finance cannot change an amount" $F "select academy_set_period_amount($CP, 1, 'not allowed')" ERR
chk "teacher cannot change an amount" $TB "select academy_set_period_amount($CP, 1, 'not allowed')" ERR
chk "a reason is required" $A "select academy_set_period_amount($CP, 80, '')" ERR
chk "amounts cannot be changed by a direct update, even by admin" $A "update academy_fee_periods set amount_due = 1 where learner_id='20000000-0000-0000-0000-000000000003'" ERR
chk "email reminder refused without email permission" $F "select academy_log_reminder($CP, 'email')" ERR
chk "admin records email permission" $A "update academy_guardians set email='parent1@example.com' where id='$G1ID'" "UPDATE 1"
chk "email permission set" $A "select academy_set_guardian_consent('$G1ID', true, true)" ""
chk "recording WhatsApp permission alone keeps email permission" $TA "select academy_set_guardian_consent('$G1ID', null, true)" ""
chk "email permission is still on" $A "select email_opt_in and whatsapp_opt_in from academy_guardians where id='$G1ID'" t
chk "finance records an email reminder" $F "select academy_log_reminder($CP, 'email') is not null" t
CA=50000000-0000-0000-0000-00000000000a
chk "teacher sets level dates for own class" $TA "select academy_set_class_level('$CA', 'English – Level 2', date '2026-08-10', date '2026-11-10')" ""
chk "level dates are stored" $A "select title||'|'||level_start||'|'||level_end from academy_classes where id='$CA'" "English – Level 2|2026-08-10|2026-11-10"
chk "another teacher cannot change this class" $TB "select academy_set_class_level('$CA', 'Hijack', date '2026-08-10', date '2026-11-10')" ERR
chk "finance cannot change a class" $F "select academy_set_class_level('$CA', 'X class', date '2026-08-10', date '2026-11-10')" ERR
chk "end must be after start" $TA "select academy_set_class_level('$CA', 'English – Level 2', date '2026-11-10', date '2026-08-10')" ERR
chk "both dates or none" $TA "select academy_set_class_level('$CA', 'English – Level 2', date '2026-11-10', null)" ERR
chk "teacher moves the class to the next level; students stay" $TA "select academy_set_class_level('$CA', 'English – Level 3', date '2026-11-18', date '2027-02-18')" ""
chk "same students still enrolled after moving up" $A "select count(*) from academy_enrollments where class_id='$CA'" 1
chk "level changes are audited" $A "select count(*) from academy_audit_events where action='SET_CLASS_LEVEL'" 2
chk "dates cannot bypass the rules by direct update" $A "update academy_classes set level_end = level_start - 1 where id='$CA'" ERR
chk "staff can read the payment methods" $TA "select count(*) >= 8 from academy_payment_methods where active" t
chk "parents/learners cannot read payment methods" $L1 "select count(*) from academy_payment_methods" 0
chk "teacher cannot add a payment method" $TA "insert into academy_payment_methods(code,label) values ('x_test','X test')" ERR
chk "admin adds a payment method" $A "insert into academy_payment_methods(code,label,sort_order) values ('telebirr','Telebirr',80)" "INSERT 0 1"
chk "admin switches an old method off" $A "update academy_payment_methods set active=false where code='other'" "UPDATE 1"
chk "a switched-off method is refused" $TB "select academy_report_payment('$P1', 'paid', current_date, 'other', null, null)" ERR
chk "an unknown method is refused" $TB "select academy_report_payment('$P1', 'paid', current_date, 'no_such_method', null, null)" ERR
chk "a report can include the amount" $TB "select academy_report_payment('$P1', 'partial', current_date, 'telebirr', 'first half', 75)" ""
chk "the amount is stored" $F "select paid_amount||'/'||paid_method from academy_fee_period_status where guardian_id='$G1ID' and learner_id is null" "75.00/telebirr"
chk "teacher sees the amount" $TB "select paid_amount from academy_teacher_fee_periods() where guardian_id='$G1ID' and period_id='$P1'" "75.00"
chk "an invalid amount is refused" $TB "select academy_report_payment('$P1', 'paid', current_date, 'telebirr', null, -5)" ERR
chk "finance checks the report" $F "update academy_fee_periods set checked_status='partial' where guardian_id='$G1ID' and learner_id is null" "UPDATE 1"
chk "changing only the amount sends it back for checking" $TB "select academy_report_payment('$P1', 'partial', current_date, 'telebirr', 'first half', 80)" ""
chk "check was reset by the amount change" $A "select checked_status from academy_fee_periods where guardian_id='$G1ID' and learner_id is null" unpaid
chk "admin switches off the method this report uses" $A "update academy_payment_methods set active=false where code='telebirr'" "UPDATE 1"
chk "the report can still be saved with its own (now switched-off) method" $TB "select academy_report_payment('$P1', 'partial', current_date, 'telebirr', 'note fixed', 80)" ""
chk "but a different switched-off method is still refused" $TB "select academy_report_payment('$P1', 'partial', current_date, 'other', null, 80)" ERR
chk "methods cannot be deleted" $A "delete from academy_payment_methods where code='telebirr'" ERR
chk "admin can enroll" $A "insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002')" "INSERT 0 1"
# Migration 0008: Israel dates, and both verified parents see their child's period.
chk "today is the date in Israel" $F "select academy_today() = (now() at time zone 'Asia/Jerusalem')::date" t
chk "a payment dated today (Israel) is accepted" $F "select academy_report_payment($CP, 'paid', academy_today(), 'israel', null, null)" ""
chk "a payment dated tomorrow is refused" $F "select academy_report_payment($CP, 'paid', academy_today() + 1, 'israel', null, null)" ERR
chk "second parent sees nothing before being linked" $E2 "select count(*) from academy_fee_period_status where learner_id='20000000-0000-0000-0000-000000000003'" 0
$PSQL -q -c "insert into academy_guardian_links(guardian_id,learner_id,verified_by_staff_id) values ('$G2ID','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-0000000000a1')" >/dev/null
chk "second verified parent sees the child's period" $E2 "select count(*) from academy_fee_period_status where learner_id='20000000-0000-0000-0000-000000000003'" 1
chk "second parent still cannot see the other parent's family period" $E2 "select count(*) from academy_fee_period_status where guardian_id='$G1ID' and learner_id is null" 0
chk "second parent cannot change the period" $E2 "update academy_fee_periods set approved_status='paid' where learner_id='20000000-0000-0000-0000-000000000003'" "UPDATE 0"
# Migration 0010: the admin manages staff roles in the app.
N1=00000000-0000-0000-0000-0000000000f1; N2=00000000-0000-0000-0000-0000000000f2
$PSQL -q -c "update auth.users set email_confirmed_at = now(); insert into auth.users(id,email,email_confirmed_at) values ('$N1','new.staff@example.com',now()),('$N2','unconfirmed@example.com',null)" >/dev/null
N1S="(select id from academy_staff where auth_user_id='$N1')"
chk "teacher cannot open the staff list" $TA "select count(*) from academy_staff_directory()" ERR
chk "finance cannot open the staff list" $F "select count(*) from academy_staff_directory()" ERR
chk "a new confirmed login waits for a role" $A "select count(*) from academy_staff_directory() where user_id='$N1' and staff_id is null" 1
chk "an unconfirmed login is not listed" $A "select count(*) from academy_staff_directory() where user_id='$N2'" 0
chk "student and parent logins are not listed" $A "select count(*) from academy_staff_directory() where user_id in ('$L1','$G1')" 0
chk "the list shows a teacher's classes" $A "select class_count from academy_staff_directory() where user_id='$TA'" 1
chk "teacher cannot give roles" $TA "select academy_set_staff_role('$N1','finance','New Person')" ERR
chk "finance cannot give roles" $F "select academy_set_staff_role('$N1','finance','New Person')" ERR
chk "a name is required" $A "select academy_set_staff_role('$N1','finance','N')" ERR
chk "only teacher, finance or admin" $A "select academy_set_staff_role('$N1','owner','New Person')" ERR
chk "admin gives the new login the finance role" $A "select academy_set_staff_role('$N1','finance','New Person')" ""
chk "the new person now has the finance role" $N1 "select academy_staff_role()" finance
chk "admin cannot change their own role" $A "select academy_set_staff_role('$A','teacher','Admin')" ERR
chk "a student login cannot be made staff" $A "select academy_set_staff_role('$L1','teacher','Student')" ERR
chk "an unconfirmed login cannot be given a role" $A "select academy_set_staff_role('$N2','teacher','Someone')" ERR
chk "a teacher with classes cannot be moved to finance" $A "select academy_set_staff_role('$TA','finance','Teacher A')" ERR
chk "roles cannot be changed by editing the table" $A "update academy_staff set role='admin' where auth_user_id='$N1'" ERR
chk "access cannot be changed by editing the table" $A "update academy_staff set active=false where auth_user_id='$N1'" ERR
chk "teacher cannot switch someone off" $TA "select academy_set_staff_active($N1S, false)" ERR
chk "admin cannot switch themself off" $A "select academy_set_staff_active('10000000-0000-0000-0000-0000000000a1', false)" ERR
chk "admin switches the new person off" $A "select academy_set_staff_active($N1S, false)" ""
chk "a switched-off person has no role" $N1 "select coalesce(academy_staff_role(),'none')" none
chk "a switched-off person cannot see their staff row" $N1 "select count(*) from academy_staff" 0
chk "a switched-off person cannot read payments" $N1 "select count(*) from academy_fee_periods" 0
chk "the list shows access off" $A "select active from academy_staff_directory() where user_id='$N1'" f
chk "admin switches the person on again" $A "select academy_set_staff_active($N1S, true)" ""
chk "access is back" $N1 "select academy_staff_role()" finance
chk "a switched-off teacher sees no students" $A "select academy_set_staff_active('10000000-0000-0000-0000-0000000000b2', false)" ""
chk "  (teacher B, while off)" $TB "select count(*) from academy_learners" 0
chk "  (teacher B cannot record attendance while off)" $TB "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002','late','10000000-0000-0000-0000-0000000000b2')" ERR
chk "teacher B switched on again" $A "select academy_set_staff_active('10000000-0000-0000-0000-0000000000b2', true)" ""
chk "  (teacher B sees students again)" $TB "select count(*) > 0 from academy_learners" t
chk "staff changes are in the audit trail" $A "select count(*) >= 3 from academy_audit_events where entity_type='academy_staff'" t

# ---- Staff chat (migration 0011) ----
AS=10000000-0000-0000-0000-0000000000a1; TAS=10000000-0000-0000-0000-0000000000b1; TBS=10000000-0000-0000-0000-0000000000b2; FS=10000000-0000-0000-0000-0000000000c1
CA=50000000-0000-0000-0000-00000000000a; CB=50000000-0000-0000-0000-00000000000b
DM="(select conversation_id from academy_chat_conversation_list() where kind='direct' limit 1)"
GRP(){ echo "(select id from academy_chat_conversations where group_key='$1')"; }
CLS(){ echo "(select id from academy_chat_conversations where class_id='$1')"; }
OWNER(){ $PSQL -q -c "reset role; $1" >/dev/null; }
chk "chat: anon cannot read conversations" anon "select count(*) from academy_chat_conversations" ERR
chk "chat: parent sees no conversations" $G1 "select count(*) from academy_chat_conversations" 0
chk "chat: parent cannot use chat" $G1 "select count(*) from academy_chat_conversation_list()" ERR
chk "chat: student cannot use chat" $L1 "select count(*) from academy_chat_conversation_list()" ERR
chk "chat: parent cannot start a chat" $G1 "select academy_chat_start_direct('$TAS')" ERR
chk "chat: a group exists for every class (incl. new ones)" $A "select count(*) from academy_chat_conversations where class_id is not null" 4
chk "chat: teacher A is in All staff, Teachers and own class only" $TA "select string_agg(coalesce(group_key, case when class_id='$CA' then 'class A' else 'other class' end), ',') from (select * from academy_chat_conversation_list() order by coalesce(group_key,'zz')) q" "all_staff,teachers,class A"
chk "chat: finance is in All staff and Finance only" $F "select string_agg(title, ',' order by title) from academy_chat_conversation_list()" "All staff,Finance"
chk "chat: admin is in every group" $A "select count(*) from academy_chat_conversation_list()" 7
chk "chat: teacher B cannot see class A's group" $TB "select count(*) from academy_chat_conversations where class_id='$CA'" 0
chk "chat: teacher B cannot post in class A's group" $TB "select academy_chat_send($(CLS $CA), 'hi', null)" ERR
chk "chat: finance cannot post in the Teachers group" $F "select academy_chat_send($(GRP teachers), 'hi', null)" ERR
chk "chat: finance posts in the Finance group" $F "select count(*) from (select academy_chat_send($(GRP finance), 'Fees list ready', null)) x" 1
chk "chat: teacher cannot read the Finance group" $TA "select count(*) from academy_chat_messages" 0
chk "chat: messages cannot be inserted directly" $TA "insert into academy_chat_messages(conversation_id,sender_staff_id,body) values ($(GRP all_staff),'$TAS','x')" ERR
chk "chat: staff list for a new chat leaves out yourself" $TA "select count(*) from academy_chat_staff_directory() where staff_id='$TAS'" 0
chk "chat: cannot chat with yourself" $TA "select academy_chat_start_direct('$TAS')" ERR
chk "chat: teacher A starts a chat with teacher B" $TA "select count(*) from (select academy_chat_start_direct('$TBS')) x" 1
chk "chat: starting again reuses the same chat" $TA "select count(*) from (select academy_chat_start_direct('$TBS')) x, academy_chat_conversations c where c.kind='direct'" 1
chk "chat: the one-to-one chat is named after the other person" $TA "select count(*) from academy_chat_conversation_list() where kind='direct' and other_staff_id='$TBS'" 1
chk "chat: teacher A sends a message" $TA "select count(*) from (select academy_chat_send($DM, 'Can you cover my class?', null)) x" 1
chk "chat: empty messages are refused" $TA "select academy_chat_send($DM, '   ', null)" ERR
chk "chat: links must be https" $TA "select academy_chat_send($DM, null, 'http://example.com/x')" ERR
chk "chat: a Drive link can be sent" $TA "select count(*) from (select academy_chat_send($DM, null, 'https://drive.google.com/file/d/abc/view')) x" 1
chk "chat: teacher B has 2 unread" $TB "select unread from academy_chat_conversation_list() where kind='direct'" 2
chk "chat: teacher B reads them" $TB "select academy_chat_mark_read($DM)" ""
chk "chat: then nothing is unread" $TB "select unread from academy_chat_conversation_list() where kind='direct'" 0
chk "chat: teacher B replies" $TB "select count(*) from (select academy_chat_send($DM, 'Yes, no problem', null)) x" 1
chk "chat: finance cannot read the one-to-one chat" $F "select count(*) from academy_chat_messages m join academy_chat_conversations c on c.id=m.conversation_id where c.kind='direct'" 0
chk "chat: admin cannot read the one-to-one chat" $A "select count(*) from academy_chat_messages m join academy_chat_conversations c on c.id=m.conversation_id where c.kind='direct'" 0
DMID=$($PSQL -c "select id from academy_chat_conversations where kind='direct'")
chk "chat: admin cannot post in it" $A "select academy_chat_send('$DMID', 'x', null)" ERR
chk "chat: admin cannot list its members" $A "select count(*) from academy_chat_participants('$DMID')" ERR
chk "chat: messages cannot be edited directly" $TA "update academy_chat_messages set body='changed'" ERR
chk "chat: teacher A cannot delete teacher B's message" $TA "select academy_chat_delete_message((select id from academy_chat_messages where body='Yes, no problem'))" ERR
chk "chat: teacher A deletes own link within 15 minutes" $TA "select academy_chat_delete_message((select id from academy_chat_messages where link_url like 'https://drive%'))" ""
chk "chat: the deleted message keeps no text" $TB "select count(*) from academy_chat_messages where deleted_at is not null and body is null and link_url is null" 1
OWNER "update academy_chat_messages set created_at = now() - interval '20 minutes' where body='Can you cover my class?'"
chk "chat: older than 15 minutes cannot be deleted" $TA "select academy_chat_delete_message((select id from academy_chat_messages where body='Can you cover my class?'))" ERR
chk "chat: report needs a reason" $TB "select academy_chat_report((select id from academy_chat_messages where body='Can you cover my class?'), 'x')" ERR
chk "chat: teacher B reports a message" $TB "select count(*) from (select academy_chat_report((select id from academy_chat_messages where body='Can you cover my class?'), 'Not appropriate')) x" 1
chk "chat: the same person cannot report it twice" $TB "select academy_chat_report((select id from academy_chat_messages where body='Can you cover my class?'), 'Again please')" ERR
chk "chat: finance reports a message in its own group" $F "select academy_chat_report((select id from academy_chat_messages where body='Fees list ready'), 'test report')" ""
chk "chat: teacher cannot see the report list" $TA "select count(*) from academy_chat_report_list()" ERR
chk "chat: admin sees the open reports" $A "select count(*) from academy_chat_report_list() where handled_at is null" 2
chk "chat: admin opens the reported chat (all 3 messages)" $A "select count(*) from academy_chat_open_report((select report_id from academy_chat_report_list() where reason='Not appropriate'))" 3
chk "chat: the opening is recorded" $A "select count(*) from academy_chat_admin_access" 1
chk "chat: teachers cannot see who opened what" $TA "select count(*) from academy_chat_admin_access" 0
chk "chat: teachers cannot open reports" $TB "select count(*) from academy_chat_open_report((select id from academy_chat_reports limit 1))" ERR
chk "chat: still no direct reading by the admin" $A "select count(*) from academy_chat_messages m join academy_chat_conversations c on c.id=m.conversation_id where c.kind='direct'" 0
chk "chat: admin marks the report handled" $A "select academy_chat_handle_report((select report_id from academy_chat_report_list() where reason='Not appropriate'), 'Spoke to both')" ""
chk "chat: a report cannot be handled twice" $A "select academy_chat_handle_report((select report_id from academy_chat_report_list() where reason='Not appropriate'), 'x')" ERR
chk "chat: reports are in the audit trail" $A "select count(*) >= 2 from academy_audit_events where entity_type='academy_chat_reports'" t
chk "chat: message text is not in the audit trail" $A "select count(*) from academy_audit_events where detail::text like '%cover my class%'" 0
chk "chat: class B's group has its teacher and the admin" $TB "select count(*) from academy_chat_participants($(CLS $CB))" 2
chk "chat: finance cannot list class B's members" $F "select count(*) from academy_chat_participants($(CLS $CB))" ERR
chk "chat: switched-off teacher B loses chat" $A "select academy_set_staff_active('$TBS', false)" ""
chk "  (cannot list chats while off)" $TB "select count(*) from academy_chat_conversation_list()" ERR
chk "  (cannot read messages while off)" $TB "select count(*) from academy_chat_messages" 0
chk "  (left out of the Teachers group members)" $TA "select count(*) from academy_chat_participants($(GRP teachers)) where staff_id='$TBS'" 0
chk "  (teacher B switched on again)" $A "select academy_set_staff_active('$TBS', true)" ""
OWNER "update academy_classes set teacher_staff_id='$TBS' where id='$CA'"
chk "chat: a new class teacher joins the class group at once" $TB "select count(*) from academy_chat_conversation_list() where class_id='$CA'" 1
chk "chat: the old teacher leaves it at once" $TA "select count(*) from academy_chat_conversations where class_id='$CA'" 0
OWNER "update academy_classes set teacher_staff_id='$TAS' where id='$CA'"
echo "RLS tests: $pass passed, $fail failed"; [ $fail = 0 ]
