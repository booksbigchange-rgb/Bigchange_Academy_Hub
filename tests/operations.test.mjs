import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_COURSES,DEMO_TEACHERS,DEMO_LEARNERS,DEMO_SLOTS,INITIAL_DEMO_CLASSES,
  createDemoClass,enrollDemoLearner,removeDemoLearner,assignDemoTeacher,visibleDemoClasses,enrolledClassCount
} from '../src/lib/operations.mjs';
const clone=()=>structuredClone(INITIAL_DEMO_CLASSES);
test('original fixture has fictional users, stable classes, valid capacity and no scheduling clashes',()=>{
  assert.equal(new Set(INITIAL_DEMO_CLASSES.map(c=>c.id)).size,INITIAL_DEMO_CLASSES.length);
  assert.ok(INITIAL_DEMO_CLASSES.every(c=>c.capacity>=c.learnerIds.length));
  for(const c of INITIAL_DEMO_CLASSES){
    assert.ok(DEMO_COURSES.some(x=>x.id===c.courseId));
    assert.ok(DEMO_TEACHERS.some(x=>x.id===c.teacherId));
    assert.ok(DEMO_SLOTS.includes(c.slot));
    assert.ok(c.learnerIds.every(id=>DEMO_LEARNERS.some(x=>x.id===id)));
  }
  assert.equal(new Set(INITIAL_DEMO_CLASSES.map(c=>c.teacherId+'@'+c.slot)).size,INITIAL_DEMO_CLASSES.length);
});
test('sample class creation validates capacity, course, teacher and slot conflicts',()=>{
  const initial=clone();
  const added=createDemoClass(initial,{courseId:'automation',teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:10});
  assert.equal(added.length,initial.length+1);
  assert.equal(initial.length,4);
  assert.deepEqual(added.at(-1).learnerIds,[]);
  assert.throws(()=>createDemoClass(initial,{courseId:'ai',teacherId:'teacher-a',slot:'Mon + Wed · 16:00',capacity:10}),/already teaches/);
  assert.throws(()=>createDemoClass(initial,{courseId:'fake',teacherId:'teacher-a',slot:'Tue + Thu · 16:00',capacity:10}));
  assert.throws(()=>createDemoClass(initial,{courseId:'ai',teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:7}),/capacity/);
});
test('sample enrollment prevents invalid students, duplicates and double enrollment per course',()=>{
  const initial=clone();
  const updated=enrollDemoLearner(initial,'class-1','learner-d');
  assert.equal(updated[0].learnerIds.length,4);
  assert.equal(initial[0].learnerIds.length,3);
  assert.throws(()=>enrollDemoLearner(updated,'class-1','learner-d'),/already enrolled/);
  assert.throws(()=>enrollDemoLearner(updated,'class-unknown','learner-g'),/not found/);
  assert.throws(()=>enrollDemoLearner(updated,'class-1','someone'));
  const other=createDemoClass(updated,{courseId:'computer',teacherId:'teacher-b',slot:'Sat + Sun · 10:00',capacity:5});
  assert.throws(()=>enrollDemoLearner(other,other.at(-1).id,'learner-d'),/another group/);
});
test('full roster has no spare seats; removals and role views are immutable',()=>{
  let current=clone();
  for(const id of ['learner-d','learner-e','learner-f','learner-g','learner-h','learner-i','learner-j'])current=enrollDemoLearner(current,'class-1',id);
  assert.equal(current[0].learnerIds.length,10);
  assert.throws(()=>enrollDemoLearner(current,'class-1','learner-k'),/capacity/);
  const removed=removeDemoLearner(current,'class-1','learner-j');
  assert.equal(removed[0].learnerIds.length,9);
  assert.equal(current[0].learnerIds.length,10);
  assert.throws(()=>removeDemoLearner(removed,'class-1','learner-j'));
  assert.equal(visibleDemoClasses(current,'Teacher').length,2);
  assert.equal(visibleDemoClasses(current,'Student').length,2);
  assert.equal(visibleDemoClasses(current,'Administrator').length,4);
  assert.equal(visibleDemoClasses(current,'Someone').length,0);
  assert.equal(enrolledClassCount(current,'learner-a'),2);
});
test('teacher reassignment validates conflicts without mutating source',()=>{
  const initial=clone();
  const overlapping=createDemoClass(initial,{courseId:'automation',teacherId:'teacher-b',slot:'Mon + Wed · 16:00',capacity:10});
  assert.throws(()=>assignDemoTeacher(overlapping,overlapping.at(-1).id,'teacher-a'),/already teaches/);
  const updated=assignDemoTeacher(initial,'class-2','teacher-c');
  assert.equal(updated[1].teacherId,'teacher-c');
  assert.equal(initial[1].teacherId,'teacher-b');
});
