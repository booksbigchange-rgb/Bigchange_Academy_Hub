import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_LEARNERS,INITIAL_DEMO_CLASSES,addDemoLearner,setDemoPersonActive} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_ACADEMICS} from '../src/lib/academics.mjs';
import {INITIAL_DEMO_ASSESSMENTS} from '../src/lib/assessments.mjs';
import {demoGuardianProfile,demoFamilyReport} from '../src/lib/family.mjs';
import {
 initialDemoGuardians,addDemoGuardian,linkDemoChild,unlinkDemoChild,setDemoGuardianActive
} from '../src/lib/guardian-admin.mjs';
import {demoSidebarSections} from '../src/lib/dashboard.mjs';

const seed=()=>initialDemoGuardians();
test('fictional guardian creation rejects real names and duplicates without changing fixture profiles',()=>{
 const previous=seed(),next=addDemoGuardian(previous,'Sample Guardian Delta');
 assert.equal(next.length,3);assert.equal(next.at(-1).id,'guardian-demo-1');
 assert.equal(next.at(-1).learnerIds.length,0);
 assert.equal(previous.length,2);
 assert.equal(addDemoGuardian(next,'Sample Guardian Echo').at(-1).id,'guardian-demo-2');
 assert.throws(()=>addDemoGuardian(next,'sample guardian delta'),/already exists/);
 assert.throws(()=>addDemoGuardian(next,'Real Relative'),/fictional/);
 assert.throws(()=>addDemoGuardian(next,'Sample Guardian Name@gmail.com'),/fictional/);
});
test('only newly created synthetic guardian profiles can link existing active fictional children',()=>{
 let guardians=addDemoGuardian(seed(),'Sample Guardian Delta');
 guardians=linkDemoChild(guardians,'guardian-demo-1','learner-b',DEMO_LEARNERS);
 assert.deepEqual(guardians.at(-1).learnerIds,['learner-b']);
 assert.deepEqual(guardians[0].learnerIds,['learner-a','learner-c']);
 assert.throws(()=>linkDemoChild(guardians,'guardian-demo-1','learner-b',DEMO_LEARNERS),/already linked/);
 assert.throws(()=>linkDemoChild(guardians,'guardian-a','learner-b',DEMO_LEARNERS),/newly created/);
 assert.throws(()=>linkDemoChild(guardians,'guardian-demo-1','unknown',DEMO_LEARNERS),/active fictional learner/);
 const inactive=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo').map(p=>
  p.id==='learner-demo-1'?{...p,active:false}:p);
 assert.throws(()=>linkDemoChild(guardians,'guardian-demo-1','learner-demo-1',inactive),/active fictional learner/);
});
test('new linked fictional guardian sees only explicitly linked child data in family report',()=>{
 let guardians=addDemoGuardian(seed(),'Sample Guardian Delta');
 guardians=linkDemoChild(guardians,'guardian-demo-1','learner-b',DEMO_LEARNERS);
 const opts={guardianId:'guardian-demo-1',classes:structuredClone(INITIAL_DEMO_CLASSES),
  academic:structuredClone(INITIAL_DEMO_ACADEMICS),assessment:structuredClone(INITIAL_DEMO_ASSESSMENTS),
  ledger:[],guardians};
 assert.equal(demoGuardianProfile('guardian-demo-1',guardians).name,'Sample Guardian Delta');
 const report=demoFamilyReport({...opts,learnerId:'learner-b'});
 assert.equal(report.classCount,1);
 assert.equal(report.learnerId,'learner-b');
 assert.equal(report.fees.outstanding,0);
 assert.throws(()=>demoFamilyReport({...opts,learnerId:'learner-c'}),/not linked/);
});
test('unlink and deactivate a new synthetic guardian without ever editing seeded relationships',()=>{
 let guardians=addDemoGuardian(seed(),'Sample Guardian Delta');
 guardians=linkDemoChild(guardians,'guardian-demo-1','learner-a',DEMO_LEARNERS);
 assert.throws(()=>setDemoGuardianActive(guardians,'guardian-demo-1',false),/Unlink/);
 assert.throws(()=>unlinkDemoChild(guardians,'guardian-a','learner-a'),/Only newly/);
 guardians=unlinkDemoChild(guardians,'guardian-demo-1','learner-a');
 assert.equal(guardians.at(-1).learnerIds.length,0);
 guardians=setDemoGuardianActive(guardians,'guardian-demo-1',false);
 assert.equal(demoGuardianProfile('guardian-demo-1',guardians),null);
 assert.throws(()=>linkDemoChild(guardians,'guardian-demo-1','learner-b',DEMO_LEARNERS),/active/);
 guardians=setDemoGuardianActive(guardians,'guardian-demo-1',true);
 assert.equal(demoGuardianProfile('guardian-demo-1',guardians).name,'Sample Guardian Delta');
 assert.deepEqual(guardians[0].learnerIds,['learner-a','learner-c']);
});
test('guardian navigation and controls are admin-only, preview selector never equals authentication',()=>{
 const admin=demoSidebarSections('Administrator');
 const teacher=demoSidebarSections('Teacher'),student=demoSidebarSections('Student');
 const guardian=demoSidebarSections('Guardian');
 assert.ok(admin.includes('Guardians'));
 assert.ok(!teacher.includes('Guardians')&&!student.includes('Guardians'));
 assert.deepEqual(guardian,['Overview','Family']);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/Selected fictional guardian preview/);
 assert.match(app,/role==='Administrator'&&<AcademyGuardianAdmin/);
 assert.match(app,/Preview role \(not login\)/);
});

test('an added fictional student must be unlinked before deactivation, even when unenrolled',()=>{
 let students=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 let guardians=addDemoGuardian(seed(),'Sample Guardian Delta');
 guardians=linkDemoChild(guardians,'guardian-demo-1','learner-demo-1',students);
 assert.throws(()=>setDemoPersonActive(students,{id:'learner-demo-1',
  role:'learner',active:false,classes:structuredClone(INITIAL_DEMO_CLASSES),guardians}),/Unlink/);
 guardians=unlinkDemoChild(guardians,'guardian-demo-1','learner-demo-1');
 students=setDemoPersonActive(students,{id:'learner-demo-1',
  role:'learner',active:false,classes:structuredClone(INITIAL_DEMO_CLASSES),guardians});
 assert.equal(students.at(-1).active,false);
});
