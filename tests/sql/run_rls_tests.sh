#!/usr/bin/env bash
# Local RLS isolation test. Usage: tests/sql/run_rls_tests.sh <psql connection args>, e.g. -h /var/tmp/pgtest -p 5544 -U postgres
# Requires a database with the auth stubs, migrations 0001 + 0002 applied, and an empty seed target.
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
chk "teacher cannot create a period" $TA "select academy_create_fee_period('$G1ID', current_date)" ERR
chk "finance creates a period" $F "select count(*) from (select academy_create_fee_period('$G1ID', current_date - 40)) x" 1
P1=$($PSQL -c "select id from academy_fee_periods where guardian_id='$G1ID'" 2>/dev/null)
chk "overlapping period rejected" $F "select academy_create_fee_period('$G1ID', current_date)" ERR
chk "finance creates an old (ended) period for guardian 2" $F "select count(*) from (select academy_create_fee_period('$G2ID', date '2024-01-01')) x" 1
chk "period is USD with computed amount" $F "select currency_code||amount_due from academy_fee_period_status where guardian_id='$G1ID'" "USD200.00"
chk "ended unapproved period is overdue" $F "select status from academy_fee_period_status where guardian_id='$G2ID'" overdue
chk "current unpaid period is unpaid" $F "select status from academy_fee_period_status where guardian_id='$G1ID'" unpaid
chk "teacher sees the parent's period with phone" $TA "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 1
chk "teacher of another parent's child sees nothing" $TB "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 0
chk "unrelated teacher cannot report" $TB "select academy_report_payment('$P1', 'paid', current_date, 'cash', null)" ERR
chk "report needs a date" $TA "select academy_report_payment($PRD, 'paid', null, 'cash', null)" ERR
chk "report cannot be future-dated" $TA "select academy_report_payment($PRD, 'paid', current_date + 2, 'cash', null)" ERR
chk "report needs a method" $TA "select academy_report_payment($PRD, 'paid', current_date, null, null)" ERR
chk "report rejects markup in note" $TA "select academy_report_payment($PRD, 'paid', current_date, 'cash', '<b>x</b>')" ERR
chk "form teacher reports a payment" $TA "select academy_report_payment($PRD, 'paid', current_date - 3, 'mobile_money', 'Receipt 123')" ""
chk "report is stage 'reported' and still not effective" $TA "select stage||'/'||status from academy_teacher_fee_periods() where guardian_id='$G1ID'" "reported/unpaid"
chk "teacher cannot edit the table directly" $TA "update academy_fee_periods set approved_status='paid'" "UPDATE 0"
chk "finance sees date, method and note" $F "select paid_on=current_date-3 and paid_method='mobile_money' and paid_note='Receipt 123' from academy_fee_period_status where guardian_id='$G1ID'" t
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
chk "teacher changing the report resets check and approval" $TA "select academy_report_payment($PRD, 'partial', current_date - 1, 'cash', null)" ""
chk "approval was reset to unpaid" $A "select approved_status||'/'||checked_status from academy_fee_periods where guardian_id='$G1ID'" "unpaid/unpaid"
chk "status after reset is unpaid again" $F "select status from academy_fee_period_status where guardian_id='$G1ID'" unpaid
chk "anon cannot call fee RPC" anon "select count(*) from academy_teacher_fee_periods()" ERR
chk "no direct inserts into periods" $F "insert into academy_fee_periods(guardian_id,period_start,period_end,course_count,amount_due) values ('$G1ID','2030-01-01','2030-04-01',1,150)" ERR
chk "finance can read enrollments" $F "select count(*)>=2 from academy_enrollments" t
chk "admin adds a sibling in teacher B's class under the same parent" $A "insert into academy_learners(id,display_name) values ('20000000-0000-0000-0000-000000000003','Sample Learner 3'); insert into academy_guardian_links values ('20000000-0000-0000-0000-000000000003','$G1ID','10000000-0000-0000-0000-0000000000a1'); insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000003')" "INSERT 0 1 INSERT 0 1 INSERT 0 1"
chk "every teacher of the parent's children sees the same record" $TB "select count(*) from academy_teacher_fee_periods() where guardian_id='$G1ID'" 1
chk "teacher B sees only own student's name" $TB "select students::text from academy_teacher_fee_periods() where guardian_id='$G1ID'" '{"Sample Learner 3"}'
chk "teacher B can report for the same parent" $TB "select academy_report_payment($PRD, 'paid', current_date - 1, 'bank', null)" ""
chk "teacher A sees teacher B's report" $TA "select reported_status||'/'||paid_method from academy_teacher_fee_periods() where guardian_id='$G1ID'" "paid/bank"
chk "same phone reuses the guardian (parent tracked by number)" $A "select count(*) from (select academy_add_guardian('20000000-0000-0000-0000-000000000003','Another Name',null,'+251911000000',false,false)) x" 1
chk "one guardian per phone number" $A "select count(*) from academy_guardians where phone_e164='+251911000000'" 1
chk "admin can enroll" $A "insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002')" "INSERT 0 1"
echo "RLS tests: $pass passed, $fail failed"; [ $fail = 0 ]
