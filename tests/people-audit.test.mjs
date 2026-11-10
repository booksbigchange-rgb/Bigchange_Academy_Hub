import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DEMO_TEACHERS,DEMO_LEARNERS,INITIAL_DEMO_CLASSES,
 addDemoTeacher,addDemoLearner,assignDemoTeacher,enrollDemoLearnerForRole
} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS} from '../src/lib/assessments.mjs';
import {demoOverviewCards} from '../src/lib/dashboard.mjs';
import {summarizeDemoAcademy} from '../src/lib/reporting.mjs';
import {demoFamilyReport} from '../src/lib/family.mjs';

const fixture=()=>({
 classes:structuredClone(INITIAL_DEMO_CLASSES),
 teachers:DEMO_TEACHERS.map(x=>({...x})),
 students:DEMO_LEARNERS.map(x=>({...x})),
 academic:structuredClone(INITIAL_DEMO_ACADEMICS),
 assessments:structuredClone(INITIAL_DEMO_ASSESSMENTS),
 ledger:[{student:'Student A',learnerId:'learner-a',guardian:'Guardian A',guardianId:'guardian-a',
   due:2500,recorded:2500,period:'October 2026'}]
});
const metric=(f,title)=>demoOverviewCards('Administrator',f).find(x=>x.title===title);
test('adding an idle teacher and unenrolled student updates directory cards before class assignment',()=>{
 const f=fixture();
 const before=summarizeDemoAcademy(f);
 assert.equal(metric(f,'Teachers').value,'3');
 assert.equal(metric(f,'Registered students').value,'16');
 f.teachers=addDemoTeacher(f.teachers,'Sample Teacher Delta');
 f.students=addDemoLearner(f.students,'Sample Learner Indigo');
 assert.equal(metric(f,'Teachers').value,'4');
 assert.equal(metric(f,'Registered students').value,'17');
 assert.equal(metric(f,'Teachers').subtitle,'3 assigned to class groups');
 assert.equal(metric(f,'Registered students').subtitle,'8 enrolled in a class');
 assert.equal(summarizeDemoAcademy(f).summary.enrollments,before.summary.enrollments);
});
test('new teacher assignment and new student enrollment update dependent reports without changing existing IDs',()=>{
 const f=fixture();
 f.teachers=addDemoTeacher(f.teachers,'Sample Teacher Delta');
 f.students=addDemoLearner(f.students,'Sample Learner Indigo');
 const teacherId=f.teachers.at(-1).id,learnerId=f.students.at(-1).id;
 f.classes=assignDemoTeacher(f.classes,'class-3',teacherId,f.teachers);
 const next=enrollDemoLearnerForRole({classes:f.classes,classId:'class-1',learnerId,
   learners:f.students,role:'Administrator'});
 assert.equal(f.classes[0].learnerIds.includes(learnerId),false);
 f.classes=next;
 const report=summarizeDemoAcademy(f);
 assert.equal(report.summary.uniqueLearners,9);
 assert.equal(report.summary.enrollments,11);
 assert.equal(report.attendance.opportunities,15); // one new learner attends two scheduled sessions
 assert.equal(report.grades.assigned,10);
 assert.equal(report.teacherRows.find(x=>x.id===teacherId).groups,1);
 assert.equal(report.teacherRows.find(x=>x.id==='teacher-a').groups,1);
 assert.equal(report.classRows[0].learners,4);
 assert.throws(()=>demoFamilyReport({guardianId:'guardian-a',learnerId,
   classes:f.classes,academic:f.academic,assessment:f.assessments,ledger:f.ledger}),/not linked/);
});
test('overview quick actions target distinct form inputs, teacher options and controlled add state exist',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const people=readFileSync(new URL('../src/components/AcademyOperations.tsx',import.meta.url),'utf8');
 assert.match(app,/openPeopleForm\('teacher'\)/);
 assert.match(app,/openPeopleForm\('student'\)/);
 assert.match(app,/focusPerson=\{peopleFocus\}/);
 assert.match(people,/teacherInput\.current\?\.focus\(\)/);
 assert.match(people,/studentInput\.current\?\.focus\(\)/);
 assert.match(people,/enrollDemoLearnerForRole/);
 assert.match(people,/\{teachers\.map\(/);
 assert.match(people,/\{activeLearners\.map\(/);
});
