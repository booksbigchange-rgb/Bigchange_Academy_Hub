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
chk "teacherA cannot see fees" $TA "select count(*) from academy_fee_obligations" 0
chk "teacherA cannot see guardians" $TA "select count(*) from academy_guardians" 0
chk "learner sees only self" $L1 "select count(*) from academy_learners" 1
chk "learner cannot see fees" $L1 "select count(*) from academy_fee_obligations" 0
chk "guardian sees only own child" $G1 "select count(*) from academy_learners" 1
chk "guardian sees only own child's fee" $G1 "select count(*) from academy_fee_obligations" 1
chk "guardian cannot write fees" $G1 "update academy_fee_obligations set amount_due=1" "UPDATE 0"
chk "admin sees both learners" $A "select count(*) from academy_learners" 2
chk "finance sees both fees" $F "select count(*) from academy_fee_obligations" 2
chk "finance cannot change classes" $F "update academy_classes set title='x'" "UPDATE 0"
chk "teacherA records attendance in own class" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','present','10000000-0000-0000-0000-0000000000b1')" "INSERT 0 1"
chk "duplicate attendance is rejected" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','absent','10000000-0000-0000-0000-0000000000b1')" ERR
chk "teacherA cannot record in other class" $TA "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002','present','10000000-0000-0000-0000-0000000000b1')" ERR
chk "teacherB cannot record learner not enrolled in class" $TB "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','present','10000000-0000-0000-0000-0000000000b2')" ERR
chk "attendance cannot be attributed to another staff" $TB "insert into academy_attendance(session_id,learner_id,status,recorded_by_staff_id) values ('60000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000002','present','10000000-0000-0000-0000-0000000000a1')" ERR
chk "learner cannot edit attendance" $L1 "update academy_attendance set status='present'" "UPDATE 0"
chk "guardian sees own child's attendance" $G1 "select count(*) from academy_attendance" 1
chk "teacherB cannot see teacherA attendance" $TB "select count(*) from academy_attendance" 0
chk "finance records payment" $F "insert into academy_external_payments(obligation_id,amount,method,recorded_by_staff_id) values ('70000000-0000-0000-0000-000000000001',500,'bank','10000000-0000-0000-0000-0000000000c1')" "INSERT 0 1"
chk "payment cannot be pre-verified" $F "insert into academy_external_payments(obligation_id,amount,method,recorded_by_staff_id,verified_by_staff_id) values ('70000000-0000-0000-0000-000000000001',5,'bank','10000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1')" ERR
chk "finance cannot verify payments" $F "update academy_external_payments set verified_by_staff_id='10000000-0000-0000-0000-0000000000c1'" "UPDATE 0"
chk "guardian sees own child's payment" $G1 "select count(*) from academy_external_payments" 1
chk "teacher cannot see payments" $TA "select count(*) from academy_external_payments" 0
chk "payments cannot be deleted" $A "delete from academy_external_payments" ERR
chk "fee status overdue (past month, partial paid)" $F "select status from academy_fee_status where period='2020-01'" overdue
chk "fee status unpaid (future month)" $F "select status from academy_fee_status where period='2099-01'" unpaid
chk "guardian fee view limited to own child" $G1 "select count(*) from academy_fee_status" 1
chk "duplicate fee month rejected" $F "insert into academy_fee_obligations(learner_id,term,amount_due,period) values ('20000000-0000-0000-0000-000000000001','t',1,'2020-01')" ERR
chk "audit visible to admin only" $F "select count(*) from academy_audit_events" 0
chk "audit has payment + attendance rows for admin" $A "select count(*)>=2 from academy_audit_events" t
chk "audit rows cannot be altered by admin" $A "update academy_audit_events set action='x'" ERR
chk "teacher cannot enroll" $TA "insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002')" ERR
chk "teacher cannot change own role" $TA "update academy_staff set role='admin'" ERR
chk "admin can enroll" $A "insert into academy_enrollments values ('50000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002')" "INSERT 0 1"
[ -n "${VERBOSE:-}" ] && true
echo "RLS tests: $pass passed, $fail failed"; [ $fail = 0 ]
