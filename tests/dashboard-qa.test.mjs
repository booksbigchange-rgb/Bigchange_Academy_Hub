import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INITIAL_DEMO_CLASSES,enrollDemoLearner} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS,markDemoSessionAttendance} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS,submitDemoProject,submitDemoQuiz,gradeDemoProject} from '../src/lib/assessments.mjs';
import {demoFamilyReport} from '../src/lib/family.mjs';
import {summarizeDemoAcademy} from '../src/lib/reporting.mjs';
import {demoSidebarSections,demoVisibleCourses,demoOverviewCards} from '../src/lib/dashboard.mjs';

const seed=()=>({
 classes:structuredClone(INITIAL_DEMO_CLASSES),
 academic:structuredClone(INITIAL_DEMO_ACADEMICS),
 assessments:structuredClone(INITIAL_DEMO_ASSESSMENTS),
 ledger:[
  {student:'Student A',guardian:'Guardian A',learnerId:'learner-a',guardianId:'guardian-a',due:2500,recorded:2500,period:'October 2026'},
  {student:'Student B',guardian:'Guardian B',learnerId:'learner-b',guardianId:'guardian-b',due:2500,recorded:1000,period:'October 2026'},
  {student:'Student C',guardian:'Guardian A',learnerId:'learner-c',guardianId:'guardian-a',due:2500,recorded:0,period:'October 2026'}
 ]
});
const metric=(cards,title)=>cards.find(x=>x.title===title)?.value;
const family=(f,guardianId,learnerId)=>demoFamilyReport({
 guardianId,learnerId,classes:f.classes,academic:f.academic,assessment:f.assessments,ledger:f.ledger
});
test('four role navigation menus have no unintended sections or duplicate entries',()=>{
 const student=demoSidebarSections('Student'),teacher=demoSidebarSections('Teacher');
 const admin=demoSidebarSections('Administrator'),guardian=demoSidebarSections('Guardian');
 assert.deepEqual(guardian,['Overview','Family']);
 assert.ok(student.includes('Quizzes')&&student.includes('Grades')&&student.includes('Attendance'));
 assert.ok(!student.some(s=>['Directory','Reports','Finance','Family'].includes(s)));
 assert.ok(teacher.includes('Directory')&&!teacher.some(s=>['Reports','Finance','Family'].includes(s)));
 assert.ok(admin.includes('Reports')&&admin.includes('Finance')&&!admin.includes('Family'));
 for(const role of ['Student','Teacher','Administrator','Guardian']){
  const menu=demoSidebarSections(role);assert.equal(menu.length,new Set(menu).size);
 }
 assert.deepEqual(demoSidebarSections('Unrecognized'),[]);
});
test('courses are derived from class memberships and a consistent five-subject catalog',()=>{
 const f=seed();
 assert.deepEqual(demoVisibleCourses('Student',f.classes).map(x=>x.id),['computer','creative']);
 assert.deepEqual(demoVisibleCourses('Teacher',f.classes).map(x=>x.id),['computer','ai']);
 assert.deepEqual(demoVisibleCourses('Administrator',f.classes).map(x=>x.id),
  ['computer','creative','ai','automation','scratch']);
 assert.equal(demoVisibleCourses('Administrator',f.classes).find(x=>x.id==='automation').courseStat,'0 groups');
 assert.deepEqual(demoVisibleCourses('Guardian',f.classes),[]);
});
test('role dashboard numbers use current records instead of hardcoded attendance or progress',()=>{
 const f=seed(),student=demoOverviewCards('Student',f),teacher=demoOverviewCards('Teacher',f);
 assert.deepEqual([metric(student,'My classes'),metric(student,'Assignments to do'),metric(student,'Submitted work'),metric(student,'Attendance recorded')],
  ['2','3','0','1 / 3']);
 assert.deepEqual([metric(teacher,'My teaching groups'),metric(teacher,'Unique learners'),metric(teacher,'To review'),metric(teacher,'Register marks')],
  ['2','5','0','3 / 9']);
 const admin=demoOverviewCards('Administrator',f);
 assert.deepEqual([metric(admin,'Unique learners'),metric(admin,'Active courses'),metric(admin,'Instructors'),metric(admin,'Balances due')],
  ['8','4','3','ETB 4,000']);
 assert.ok(!JSON.stringify(student).includes('92%')&&!JSON.stringify(teacher).includes('94%'));
 assert.deepEqual(demoOverviewCards('Guardian',f),[]);
});
test('enrollment and session marks update teacher/student cards and linked-child reports',()=>{
 const f=seed();
 f.classes=enrollDemoLearner(f.classes,'class-2','learner-c');
 assert.equal(summarizeDemoAcademy(f).summary.enrollments,11);
 assert.equal(family(f,'guardian-a','learner-c').classCount,3);
 f.academic=markDemoSessionAttendance(f.academic,{
  classes:f.classes,sessions:f.academic.sessions,sessionId:'session-2',learnerId:'learner-a',status:'Late'
 });
 assert.equal(metric(demoOverviewCards('Student',f),'Attendance recorded'),'2 / 3');
 assert.equal(metric(demoOverviewCards('Teacher',f),'Register marks'),'4 / 9');
 assert.equal(summarizeDemoAcademy(f).attendance.late,2);
});
test('student project to teacher rubric to quiz to guardian and admin dashboard agrees',()=>{
 const f=seed();
 f.assessments=submitDemoProject(f.assessments,{classes:f.classes,role:'Student',
  taskId:'task-1',learnerId:'learner-a',response:'The CPU follows instructions and the SSD stores sample files.'});
 assert.equal(metric(demoOverviewCards('Student',f),'Assignments to do'),'2');
 assert.equal(metric(demoOverviewCards('Teacher',f),'To review'),'1');
 assert.equal(family(f,'guardian-a','learner-a').progress.awaitingReview,1);
 f.assessments=gradeDemoProject(f.assessments,{classes:f.classes,role:'Teacher',
  taskId:'task-1',learnerId:'learner-a',scores:{accuracy:4,clarity:3,completion:2},
  feedback:'Good fictional hardware explanation with a detailed answer.'});
 assert.equal(metric(demoOverviewCards('Teacher',f),'To review'),'0');
 f.assessments=submitDemoQuiz(f.assessments,{classes:f.classes,role:'Student',
  taskId:'task-2',learnerId:'learner-a',answers:[0,1,2]});
 assert.equal(family(f,'guardian-a','learner-a').progress.average,95);
 assert.equal(metric(demoOverviewCards('Student',f),'Submitted work'),'2');
 assert.equal(metric(demoOverviewCards('Student',f),'Assignments to do'),'1');
 assert.equal(summarizeDemoAcademy(f).grades.graded,2);
 assert.throws(()=>family(f,'guardian-a','learner-b'),/not linked/);
});
test('offline money edits affect admin totals and only the linked fictional guardian',()=>{
 const f=seed();
 assert.equal(family(f,'guardian-b','learner-b').fees.outstanding,1500);
 f.ledger[1].recorded+=500;
 assert.equal(metric(demoOverviewCards('Administrator',f),'Balances due'),'ETB 3,500');
 assert.equal(family(f,'guardian-b','learner-b').fees.outstanding,1000);
 assert.equal(family(f,'guardian-a','learner-a').fees.outstanding,0);
});
test('guardian section navigation retains component identity; mobile nav has focus and scrolling',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(app,/role==='Guardian'&&\(section==='Overview'\|\|section==='Family'\)/);
 assert.doesNotMatch(app,/<AcademyFamily key=\{section\}/);
 assert.match(css,/\.navitem:focus-visible/);
 assert.match(css,/overscroll-behavior-x:contain/);
});
