import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 INITIAL_DEMO_CLASSES,DEMO_TEACHERS,DEMO_LEARNERS,
 createDemoClass,enrollDemoLearner,updateDemoClass,transferDemoLearner
} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_SESSIONS} from '../src/lib/academics.mjs';

const groups=()=>structuredClone(INITIAL_DEMO_CLASSES);
const computerDestination=(data=groups())=>createDemoClass(data,{
 courseId:'computer',teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:5
});
test('changing a class instructor, meeting slot and seat limit retains its roster and ID',()=>{
 const source=groups(),altered=updateDemoClass(source,'class-1',{
  teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:5
 },{teachers:DEMO_TEACHERS,sessions:INITIAL_DEMO_SESSIONS});
 assert.equal(source[0].teacherId,'teacher-a');
 assert.equal(altered[0].teacherId,'teacher-b');
 assert.equal(altered[0].slot,'Mon + Wed · 10:00');
 assert.deepEqual(altered[0].learnerIds,source[0].learnerIds);
 assert.equal(altered[0].capacity,5);
 assert.equal(altered.length,source.length);
});
test('reject schedule changes that invalidate existing lesson days or duplicate a learner timetable',()=>{
 const source=groups();
 assert.throws(()=>updateDemoClass(source,'class-1',{
  teacherId:'teacher-a',slot:'Tue + Thu · 16:00',capacity:10
 },{teachers:DEMO_TEACHERS,sessions:INITIAL_DEMO_SESSIONS}),/Existing lessons/);
 assert.throws(()=>updateDemoClass(source,'class-1',{
  teacherId:'teacher-a',slot:'Tue + Thu · 16:00',capacity:10
 },{teachers:DEMO_TEACHERS,sessions:[]}),/learner.*another group/);
 assert.throws(()=>updateDemoClass(source,'class-1',{
  teacherId:'teacher-b',slot:'Tue + Thu · 16:00',capacity:10
 },{teachers:DEMO_TEACHERS,sessions:[]}),/Instructor already/);
});
test('reject invalid edits, inactive teachers, and capacity reductions beneath enrollment',()=>{
 const source=groups();
 assert.throws(()=>updateDemoClass(source,'unknown',{teacherId:'teacher-a',slot:source[0].slot,capacity:10}),/not found/);
 assert.throws(()=>updateDemoClass(source,'class-1',{teacherId:'teacher-a',slot:source[0].slot,capacity:1}),/capacity/);
 assert.throws(()=>updateDemoClass(source,'class-1',{teacherId:'teacher-a',slot:source[0].slot,capacity:5},
  {teachers:[{id:'teacher-a',name:'Inactive',active:false}],sessions:[]}),/active/);
 const group=computerDestination(source);
 let full=group;
 for(const id of ['learner-d','learner-e','learner-f','learner-i','learner-j']){
  full=enrollDemoLearner(full,group.at(-1).id,id);
 }
 assert.equal(full.at(-1).learnerIds.length,5);
 assert.throws(()=>updateDemoClass(full,group.at(-1).id,{
  teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:1
 }),/capacity/);
});
test('same-course transfer is atomic and retains original class and learner identities',()=>{
 const source=computerDestination(groups()),destId=source.at(-1).id;
 const moved=transferDemoLearner(source,{
  fromClassId:'class-1',toClassId:destId,learnerId:'learner-a'
 });
 assert.equal(source[0].learnerIds.includes('learner-a'),true);
 assert.equal(source.at(-1).learnerIds.length,0);
 assert.equal(moved[0].learnerIds.includes('learner-a'),false);
 assert.equal(moved.at(-1).learnerIds.includes('learner-a'),true);
 assert.equal(moved[0].id,'class-1');
});
test('transfer errors never remove an existing roster member',()=>{
 const source=computerDestination(groups()),destId=source.at(-1).id;
 const attempts=[
  {fromClassId:'class-1',toClassId:'class-1',learnerId:'learner-a'},
  {fromClassId:'class-1',toClassId:'class-2',learnerId:'learner-a'},
  {fromClassId:'class-1',toClassId:'missing',learnerId:'learner-a'},
  {fromClassId:'class-1',toClassId:destId,learnerId:'learner-i'},
 ];
 for(const args of attempts){
  assert.throws(()=>transferDemoLearner(source,args));
  assert.equal(source[0].learnerIds.includes('learner-a'),true);
 }
 let full=source;
 for(const id of ['learner-d','learner-e','learner-f','learner-i','learner-j'])
   full=enrollDemoLearner(full,destId,id);
 assert.throws(()=>transferDemoLearner(full,{
  fromClassId:'class-1',toClassId:destId,learnerId:'learner-a'
 }),/capacity/);
 assert.ok(full[0].learnerIds.includes('learner-a'));
 assert.equal(full.at(-1).learnerIds.length,5);
});
test('transfer supports newly created fictional learner records via caller supplied directory',()=>{
 const learners=[...DEMO_LEARNERS,{id:'learner-demo-1',name:'Sample Learner Indigo'}];
 let source=enrollDemoLearner(groups(),'class-1','learner-demo-1',learners);
 source=computerDestination(source);
 const moved=transferDemoLearner(source,{
  fromClassId:'class-1',toClassId:source.at(-1).id,learnerId:'learner-demo-1'
 },learners);
 assert.ok(moved.at(-1).learnerIds.includes('learner-demo-1'));
});
test('admin class edit, search and transfer controls are present and wired to immutable helpers',()=>{
 const src=readFileSync(new URL('../src/components/AcademyOperations.tsx',import.meta.url),'utf8');
 assert.match(src,/updateDemoClass\(classes,editClassId/);
 assert.match(src,/transferDemoLearner\(classes/);
 assert.match(src,/Find fictional student/);
 assert.match(src,/Active and unenrolled/);
 assert.match(src,/Save sample class changes/);
 assert.match(src,/Transfer fictional student/);
});
