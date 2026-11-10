import test from 'node:test';import assert from 'node:assert/strict';
import {INITIAL_DEMO_CLASSES,createDemoClass,enrollDemoLearner} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS,submitDemoQuiz} from '../src/lib/assessments.mjs';
import {summarizeDemoAcademy,demoAggregateCsv,safeCsvCell} from '../src/lib/reporting.mjs';
const fixture=()=>({classes:structuredClone(INITIAL_DEMO_CLASSES),academic:structuredClone(INITIAL_DEMO_ACADEMICS),
 assessments:structuredClone(INITIAL_DEMO_ASSESSMENTS),ledger:[
  {student:'Student A',guardian:'Guardian A',learnerId:'learner-a',guardianId:'guardian-a',due:2500,recorded:2500,period:'October 2026'},
  {student:'Student B',guardian:'Guardian B',learnerId:'learner-b',guardianId:'guardian-b',due:2500,recorded:1000,period:'October 2026'},
  {student:'Student C',guardian:'Guardian A',learnerId:'learner-c',guardianId:'guardian-a',due:2500,recorded:0,period:'October 2026'}
 ]});
test('snapshot counts unique learners separately from course enrollments',()=>{
 const r=summarizeDemoAcademy(fixture());
 assert.deepEqual([r.summary.classes,r.summary.uniqueLearners,r.summary.enrollments,r.summary.capacity,r.summary.utilization],[4,8,10,40,25]);
 assert.equal(r.teacherRows.find(x=>x.id==='teacher-a').weeklySessions,4);
 assert.equal(r.historicalEnrollmentAvailable,false);
});
test('attendance excludes unmarked/excused and does not invent missing data',()=>{
 const f=fixture(),r=summarizeDemoAcademy(f);
 assert.deepEqual([r.attendance.opportunities,r.attendance.present,r.attendance.late,r.attendance.absent,r.attendance.unmarked,r.attendance.markedRate],[13,1,1,1,10,67]);
 f.academic.attendance.push({sessionId:'session-2',learnerId:'learner-a',status:'Excused'});
 const e=summarizeDemoAcademy(f);
 assert.equal(e.attendance.excused,1);assert.equal(e.attendance.markedRate,67);
 const empty=summarizeDemoAcademy({...f,termId:'term-spring-2027'});
 assert.equal(empty.attendance.markedRate,null);
});
test('academic filtering cannot silently narrow school-wide fee totals',()=>{
 const f=fixture(),r=summarizeDemoAcademy({...f,courseId:'computer',teacherId:'teacher-a',termId:'term-spring-2027'});
 assert.equal(r.summary.classes,1);assert.equal(r.summary.enrollments,3);assert.equal(r.grades.assigned,0);
 assert.equal(r.fees.outstanding,4000);
 assert.throws(()=>summarizeDemoAcademy({...f,courseId:'invalid'}),/course filter/);
 assert.throws(()=>summarizeDemoAcademy({...f,termId:'invalid'}),/term filter/);
});
test('reconciliation sums valid fees and flags invalid/overpaid items',()=>{
 const f=fixture(),r=summarizeDemoAcademy(f);
 assert.deepEqual([r.fees.due,r.fees.recorded,r.fees.outstanding,r.fees.paid,r.fees.partial,r.fees.unpaid],[7500,3500,4000,1,1,1]);
 f.ledger.push({due:100,recorded:200,period:'October 2026'});
 const bad=summarizeDemoAcademy(f);assert.equal(bad.fees.exceptions.length,1);assert.equal(bad.fees.outstanding,4000);
 assert.throws(()=>summarizeDemoAcademy({...f,period:'August 2030'}),/payment period/);
});
test('filters update dynamically after enrollment and grades',()=>{
 const f=fixture();
 f.classes=createDemoClass(f.classes,{courseId:'automation',teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:10});
 f.classes=enrollDemoLearner(f.classes,f.classes.at(-1).id,'learner-a');
 assert.equal(summarizeDemoAcademy(f).summary.enrollments,11);
 assert.equal(summarizeDemoAcademy(f).summary.uniqueLearners,8);
 f.assessments=submitDemoQuiz(f.assessments,{classes:f.classes,role:'Student',taskId:'task-2',learnerId:'learner-a',answers:[0,1,2]});
 const r=summarizeDemoAcademy(f);
 assert.equal(r.grades.assigned,8);assert.equal(r.grades.graded,1);assert.equal(r.grades.average,100);
});
test('CSV export quotes formula cells and includes aggregates only',()=>{
 assert.ok(safeCsvCell('=SUM(1)').startsWith(String.fromCharCode(34,39)));
 assert.equal(safeCsvCell(' "quoted"'),'" ""quoted"""');
 assert.ok(safeCsvCell('  +invalid').startsWith(String.fromCharCode(34,39)));
 const csv=demoAggregateCsv(summarizeDemoAcademy(fixture()));
 assert.ok(csv.startsWith('\uFEFF"Section","Name","Metric","Value","Scope"'));
 assert.match(csv,/"External fees","Academy ledger","outstanding","4000"/);
 assert.doesNotMatch(csv,/Student A|Guardian A|learner-a|guardian-a/i);
});
