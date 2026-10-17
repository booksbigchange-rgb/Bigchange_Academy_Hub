import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DEMO_TEACHERS,DEMO_LEARNERS,INITIAL_DEMO_CLASSES,
 addDemoTeacher,addDemoLearner,createDemoClass,enrollDemoLearner,assignDemoTeacher
} from '../src/lib/operations.mjs';
const groups=()=>structuredClone(INITIAL_DEMO_CLASSES);
test('sample Add Teacher and Add Student create immutable people, not real accounts',()=>{
 const t=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta');
 const l=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 assert.equal(t.length,4);assert.equal(t.at(-1).id,'teacher-demo-1');
 assert.equal(l.length,17);assert.equal(l.at(-1).id,'learner-demo-1');
 assert.equal(DEMO_TEACHERS.length,3);assert.equal(DEMO_LEARNERS.length,16);
 assert.equal(addDemoTeacher(t,'Sample Teacher Echo').at(-1).id,'teacher-demo-2');
});
test('reject duplicate fictional names, email addresses and non-sample names',()=>{
 assert.throws(()=>addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta@domain.com'),/fictional/);
 assert.throws(()=>addDemoTeacher(DEMO_TEACHERS,'Real Person'),/fictional/);
 assert.throws(()=>addDemoLearner(DEMO_LEARNERS,'Learner Z'),/fictional/);
 const added=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 assert.throws(()=>addDemoLearner(added,'  sample   learner  indigo '),/already exists/);
});
test('new instructors may be assigned to groups without schedule collisions',()=>{
 const t=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta'),id=t.at(-1).id;
 const next=createDemoClass(groups(),{courseId:'automation',teacherId:id,slot:'Mon + Wed · 10:00',capacity:10},t);
 assert.equal(next.at(-1).teacherId,id);
 assert.equal(assignDemoTeacher(groups(),'class-1',id,t)[0].teacherId,id);
 assert.throws(()=>assignDemoTeacher(next,'class-4',id,t),/already teaches/);
 assert.throws(()=>createDemoClass(groups(),{courseId:'automation',teacherId:id,slot:'Mon + Wed · 10:00',capacity:10}),/Choose valid/);
});
test('new sample learners can enroll, still respecting class/duplicate rules',()=>{
 const l=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo'),id=l.at(-1).id;
 const joined=enrollDemoLearner(groups(),'class-1',id,l);
 assert.equal(joined[0].learnerIds.includes(id),true);
 assert.throws(()=>enrollDemoLearner(joined,'class-1',id,l),/already enrolled/);
 assert.throws(()=>enrollDemoLearner(groups(),'class-1',id),/Choose a fictional learner/);
});
