import test from 'node:test';
import assert from 'node:assert/strict';
import {updatePersonProfile,personDetails,GRADE_LEVELS} from '../src/lib/profiles.mjs';
import {DEMO_LEARNERS,DEMO_TEACHERS,INITIAL_DEMO_CLASSES,DEMO_COURSES} from '../src/lib/operations.mjs';
test('learner profile saves valid grade and rejects bad input without mutating',()=>{
 const before=structuredClone(DEMO_LEARNERS.map(l=>({...l})));
 const next=updatePersonProfile(before,'learner-a','learner',{gradeLevel:GRADE_LEVELS[2],note:'  Needs   large print '});
 assert.equal(next.find(p=>p.id==='learner-a').gradeLevel,'Grade 7');
 assert.equal(next.find(p=>p.id==='learner-a').note,'Needs large print');
 assert.equal(before[0].gradeLevel,undefined);
 assert.throws(()=>updatePersonProfile(before,'learner-a','learner',{gradeLevel:'Grade 99'}),/grade/);
 assert.throws(()=>updatePersonProfile(before,'learner-a','learner',{note:'a@b.com'}),/email/);
 assert.throws(()=>updatePersonProfile(before,'nope','learner',{}),/existing/);
});
test('inactive people cannot be edited; teacher specialty length enforced',()=>{
 const t=[{id:'t1',name:'Sample Teacher X',active:false}];
 assert.throws(()=>updatePersonProfile(t,'t1','teacher',{specialty:'x'}),/Reactivate/);
 const ok=[{id:'t1',name:'Sample Teacher X'}];
 assert.throws(()=>updatePersonProfile(ok,'t1','teacher',{specialty:'x'.repeat(41)}),/40/);
});
test('details reflect classes and guardians',()=>{
 const d=personDetails('teacher','teacher-a',{classes:INITIAL_DEMO_CLASSES,courses:DEMO_COURSES});
 assert.equal(d.classes.length,2);assert.equal(d.learnerCount,5);
 const s=personDetails('learner','learner-a',{classes:INITIAL_DEMO_CLASSES,courses:DEMO_COURSES,guardians:[{id:'g1',name:'G',learnerIds:['learner-a']}]});
 assert.deepEqual(s.guardians,['G']);assert.equal(s.classes.length,2);
});
