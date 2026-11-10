import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_LEARNERS,addDemoLearner} from '../src/lib/operations.mjs';
import {initialDemoGuardians,addDemoGuardian,linkDemoChild} from '../src/lib/guardian-admin.mjs';
import {addDemoFeeObligation} from '../src/lib/finance.mjs';
import {demoFamilyReport} from '../src/lib/family.mjs';
import {INITIAL_DEMO_CLASSES} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS} from '../src/lib/assessments.mjs';
import {summarizeDemoAcademy} from '../src/lib/reporting.mjs';

const ledger=()=>[
 {student:'Student A',learnerId:'learner-a',guardian:'Guardian A',guardianId:'guardian-a',due:2500,recorded:2500,period:'October 2026'},
 {student:'Student B',learnerId:'learner-b',guardian:'Guardian B',guardianId:'guardian-b',due:2500,recorded:1000,period:'October 2026'}
];
const req=(overrides={})=>({learnerId:'learner-a',guardianId:'guardian-a',period:'2026-11',due:2500,...overrides});
test('admin can create one fictitious fee obligation for linked student and guardian without mutating ledger',()=>{
 const previous=ledger(),next=addDemoFeeObligation(previous,req(),DEMO_LEARNERS,initialDemoGuardians());
 assert.equal(previous.length,2);assert.equal(next.length,3);
 assert.deepEqual(next.at(-1),{
  learnerId:'learner-a',student:'Learner A',guardianId:'guardian-a',guardian:'Guardian A',
  period:'2026-11',due:2500,recorded:0
 });
 const summary=summarizeDemoAcademy({classes:structuredClone(INITIAL_DEMO_CLASSES),
  academic:structuredClone(INITIAL_DEMO_ACADEMICS),assessments:structuredClone(INITIAL_DEMO_ASSESSMENTS),
  ledger:next});
 assert.equal(summary.fees.outstanding,4000);
 const family=demoFamilyReport({guardianId:'guardian-a',learnerId:'learner-a',
  classes:structuredClone(INITIAL_DEMO_CLASSES),academic:structuredClone(INITIAL_DEMO_ACADEMICS),
  assessment:structuredClone(INITIAL_DEMO_ASSESSMENTS),ledger:next});
 assert.equal(family.fees.outstanding,2500);
});
test('duplicate month rejected even when original fixtures use long English month name',()=>{
 assert.throws(()=>addDemoFeeObligation(ledger(),req({period:'2026-10'}),DEMO_LEARNERS,initialDemoGuardians()),/already exists/);
 const first=addDemoFeeObligation(ledger(),req(),DEMO_LEARNERS,initialDemoGuardians());
 assert.throws(()=>addDemoFeeObligation(first,req(),DEMO_LEARNERS,initialDemoGuardians()),/already exists/);
});
test('fee obligations reject unlinked guardians, invalid months, and invalid ETB amounts',()=>{
 const guardians=initialDemoGuardians();
 assert.throws(()=>addDemoFeeObligation(ledger(),req({guardianId:'guardian-b'}),DEMO_LEARNERS,guardians),/linked/);
 assert.throws(()=>addDemoFeeObligation(ledger(),req({learnerId:'not-real'}),DEMO_LEARNERS,guardians),/active fictional student/);
 assert.throws(()=>addDemoFeeObligation(ledger(),req({due:-10}),DEMO_LEARNERS,guardians),/positive/);
 assert.throws(()=>addDemoFeeObligation(ledger(),req({due:2.5}),DEMO_LEARNERS,guardians),/positive/);
 assert.throws(()=>addDemoFeeObligation(ledger(),req({due:1000001}),DEMO_LEARNERS,guardians),/positive/);
 assert.throws(()=>addDemoFeeObligation(ledger(),req({period:'2026-13'}),DEMO_LEARNERS,guardians),/valid/);
});
test('a newly created learner with a synthetic guardian link can receive a new fee obligation',()=>{
 const learners=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 let guardians=addDemoGuardian(initialDemoGuardians(),'Sample Guardian Delta');
 guardians=linkDemoChild(guardians,'guardian-demo-1','learner-demo-1',learners);
 const result=addDemoFeeObligation(ledger(),{learnerId:'learner-demo-1',
  guardianId:'guardian-demo-1',period:'2026-11',due:1500},learners,guardians);
 assert.equal(result.at(-1).student,'Sample Learner Indigo');
 assert.equal(result.at(-1).guardian,'Sample Guardian Delta');
 assert.equal(result.at(-1).recorded,0);
});
