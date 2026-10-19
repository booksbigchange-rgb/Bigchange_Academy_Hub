import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 INITIAL_DEMO_CLASSES,DEMO_TEACHERS,DEMO_LEARNERS,createDemoClass,
 enrollDemoLearner,enrollDemoLearnerForRole,addDemoTeacher,addDemoLearner
} from '../src/lib/operations.mjs';
import {demoOverviewHighlight} from '../src/lib/dashboard.mjs';
const fixture=()=>structuredClone(INITIAL_DEMO_CLASSES);

test('enrollment rejects another subject in an already booked weekly time slot',()=>{
 const otherTeacher=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta');
 const classes=createDemoClass(fixture(),{
  courseId:'automation',teacherId:otherTeacher.at(-1).id,
  slot:'Mon + Wed · 16:00',capacity:10
 },otherTeacher);
 const c=classes.at(-1);
 assert.throws(()=>enrollDemoLearner(classes,c.id,'learner-a'),/same weekly time/);
 assert.throws(()=>enrollDemoLearnerForRole({
  classes,classId:c.id,learnerId:'learner-a',role:'Administrator'
 }),/same weekly time/);
 assert.equal(c.learnerIds.length,0);
 assert.equal(classes[0].learnerIds.includes('learner-a'),true);
});
test('learner may study on same days at different times, or attend on other days',()=>{
 const c=fixture();
 assert.equal(enrollDemoLearner(c,'class-4','learner-a')[3].learnerIds.includes('learner-a'),true);
 assert.equal(enrollDemoLearner(c,'class-3','learner-b')[2].learnerIds.includes('learner-b'),true);
});
test('both existing and newly created learner identities receive same overlap protection',()=>{
 const people=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 const id=people.at(-1).id;
 const a=enrollDemoLearner(fixture(),'class-1',id,people);
 const teachers=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta');
 const b=createDemoClass(a,{
  courseId:'automation',teacherId:teachers.at(-1).id,
  slot:'Mon + Wed · 16:00',capacity:5
 },teachers);
 assert.throws(()=>enrollDemoLearner(b,b.at(-1).id,id,people),/same weekly time/);
 assert.equal(b.at(-1).learnerIds.length,0);
});
test('role-specific overview class highlights follow actual assigned groups',()=>{
 const classes=fixture();
 const a=demoOverviewHighlight('Student',classes,{learnerId:'learner-a'});
 assert.equal(a.subject,'Computer Foundations · CLASS-1');
 assert.equal(a.schedule,'Mon + Wed · 16:00');
 assert.match(a.practice,/CPU/);
 const teacher=demoOverviewHighlight('Teacher',classes,{teacherId:'teacher-b'});
 assert.equal(teacher.subject,'Creative Design · CLASS-2');
 assert.equal(teacher.schedule,'Tue + Thu · 16:00');
 assert.match(teacher.practice,/poster/);
 const empty=demoOverviewHighlight('Student',classes,{learnerId:'learner-p'});
 assert.match(empty.subject,/No fictional groups assigned/);
 assert.match(empty.schedule,/Add or enroll/);
 const admin=demoOverviewHighlight('Administrator',classes);
 assert.equal(admin.subject,'Computer Foundations · CLASS-1');
});
test('frontend does not use misleading static next-class advice or inactive-teacher report options',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(app,/<strong>Next class<\/strong>/);
 assert.doesNotMatch(app,/<small>Computer Foundations · sample schedule<\/small>/);
 assert.match(app,/demoOverviewHighlight\(role,classrooms,identity(?:,courses)?\)/);
 assert.match(app,/teachers=\{activeTeachers\} financeChanges=/);
});
