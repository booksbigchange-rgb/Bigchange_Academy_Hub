import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {INITIAL_DEMO_CLASSES,removeDemoLearner} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS} from '../src/lib/assessments.mjs';
import {demoGuardianProfile,demoGuardianChildren,demoFamilyReport} from '../src/lib/family.mjs';
const classes=()=>structuredClone(INITIAL_DEMO_CLASSES);
const academics=()=>structuredClone(INITIAL_DEMO_ACADEMICS);
const assessment=()=>structuredClone(INITIAL_DEMO_ASSESSMENTS);
const ledger=[
  {student:'Student A',learnerId:'learner-a',guardian:'Guardian A',guardianId:'guardian-a',period:'October 2026',due:2500,recorded:2500},
  {student:'Student B',learnerId:'learner-b',guardian:'Guardian B',guardianId:'guardian-b',period:'October 2026',due:2500,recorded:1000},
  {student:'Student C',learnerId:'learner-c',guardian:'Guardian A',guardianId:'guardian-a',period:'October 2026',due:2500,recorded:0}
];
const report=(guardianId='guardian-a',learnerId='learner-a',overrides={})=>demoFamilyReport({
  guardianId,learnerId,classes:classes(),academic:academics(),assessment:assessment(),ledger,...overrides
});
test('guardian-child links are explicit fake profiles; unsupported IDs fail closed',()=>{
  assert.deepEqual(demoGuardianChildren('guardian-a'),['learner-a','learner-c']);
  assert.deepEqual(demoGuardianChildren('guardian-b'),['learner-b']);
  assert.deepEqual(demoGuardianChildren('unknown'),[]);
  assert.equal(demoGuardianProfile('guardian-a').name,'Guardian A');
  assert.throws(()=>report('unknown','learner-a'),/Unknown/);
  assert.throws(()=>report('guardian-a','learner-b'),/not linked/);
  assert.throws(()=>report('guardian-b','learner-c'),/not linked/);
});
test('synthetic reports reveal only linked child group sessions and marks',()=>{
  const a=report();
  assert.deepEqual(a.classIds,['class-1','class-2']);
  assert.equal(a.attendance.scheduled,3);
  assert.equal(a.attendance.attended,1);
  assert.equal(a.attendance.marked,1);
  assert.equal(a.attendance.unmarked,2);
  assert.deepEqual(a.lessons.map(x=>x.status),['Present','Unmarked','Unmarked']);
  assert.ok(a.lessons.every(x=>['class-1','class-2'].includes(x.classId)));
  const c=report('guardian-a','learner-c');
  assert.deepEqual(c.classIds,['class-1','class-3']);
  assert.equal(c.attendance.attended,1);
  assert.ok(c.lessons.some(x=>x.status==='Late'));
});
test('fee summaries require matching child ID and matching guardian ID',()=>{
  const a=report();
  assert.deepEqual(a.fees,{due:2500,recorded:2500,outstanding:0});
  assert.equal(a.ledgerRows.length,1);
  const c=report('guardian-a','learner-c');
  assert.deepEqual(c.fees,{due:2500,recorded:0,outstanding:2500});
  const b=report('guardian-b','learner-b');
  assert.deepEqual(b.fees,{due:2500,recorded:1000,outstanding:1500});
  const spoofed=report('guardian-a','learner-c',{ledger:[
    {learnerId:'learner-c',guardianId:'guardian-b',period:'Test',due:100,recorded:100},
    {learnerId:'learner-c',guardianId:'guardian-a',period:'Only legitimate sample',due:80,recorded:30}
  ]});
  assert.equal(spoofed.ledgerRows.length,1);
  assert.equal(spoofed.fees.outstanding,50);
});
test('grade summaries include only the linked child and only graded attempts',()=>{
  const state=assessment();
  state.submissions=[
    {taskId:'task-1',learnerId:'learner-a',status:'graded',points:8,maxPoints:10,feedback:'Fictional feedback for this learner.'},
    {taskId:'task-2',learnerId:'learner-a',status:'graded',points:3,maxPoints:3,feedback:'Example quiz scored.'},
    {taskId:'task-1',learnerId:'learner-b',status:'graded',points:10,maxPoints:10,feedback:'Other learner’s private comments.'}
  ];
  const a=report('guardian-a','learner-a',{assessment:state});
  assert.equal(a.progress.assigned,3);
  assert.equal(a.progress.graded,2);
  assert.equal(a.progress.average,90);
  assert.ok(a.assigned.every(t=>!t.feedback.includes('Other learner')));
  assert.ok(a.assigned.every(t=>t.classId==='class-1'||t.classId==='class-2'));
  assert.equal(report('guardian-a','learner-c',{assessment:state}).progress.average,null);
});
test('changing classroom enrollment updates scoped guardian academics and tasks',()=>{
  const updated=removeDemoLearner(classes(),'class-1','learner-c');
  const c=report('guardian-a','learner-c',{classes:updated});
  assert.deepEqual(c.classIds,['class-3']);
  assert.ok(c.lessons.every(l=>l.classId==='class-3'));
  assert.equal(c.progress.assigned,0);
});
test('fictional guardian preference UI never performs message dispatch',()=>{
  // Check the public page does not contain a messaging/send operation.
  // Delivery, contact verification and consent remain backend release gates.
  const src=readFileSync(new URL('../src/components/AcademyFamily.tsx',import.meta.url),'utf8');
  assert.match(src,/does not verify contact details/);
  assert.doesNotMatch(src,/fetch\s*\(|\.sendEmail\s*\(|\.sendMessage\s*\(|whatsapp\.com\/send/i);
});
