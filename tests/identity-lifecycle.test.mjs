import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DEMO_TEACHERS,DEMO_LEARNERS,INITIAL_DEMO_CLASSES,addDemoTeacher,addDemoLearner,
 renameDemoPerson,setDemoPersonActive,activeDemoPeople,visibleDemoClasses,assignDemoTeacher,
 enrollDemoLearner
} from '../src/lib/operations.mjs';
import {
 INITIAL_DEMO_ASSESSMENTS,submitDemoQuiz,submitDemoProject,gradeDemoProject,
 createDemoAssessment,visibleDemoTasks,demoGradeRows
} from '../src/lib/assessments.mjs';
import {INITIAL_DEMO_TERMS} from '../src/lib/academics.mjs';
import {demoOverviewCards,demoVisibleCourses} from '../src/lib/dashboard.mjs';
const classes=()=>structuredClone(INITIAL_DEMO_CLASSES);
const assessment=()=>structuredClone(INITIAL_DEMO_ASSESSMENTS);
test('selected instructor changes class groups and courses without changing original role behavior',()=>{
 const c=classes();
 assert.deepEqual(visibleDemoClasses(c,'Teacher').map(x=>x.id),['class-1','class-3']);
 assert.deepEqual(visibleDemoClasses(c,'Teacher',{teacherId:'teacher-b'}).map(x=>x.id),['class-2']);
 assert.deepEqual(demoVisibleCourses('Teacher',c,{teacherId:'teacher-b'}).map(x=>x.id),['creative']);
 assert.equal(visibleDemoClasses(c,'Teacher',{teacherId:'teacher-demo-1'}).length,0);
 assert.deepEqual(visibleDemoClasses(c,'Student',{learnerId:'learner-b'}).map(x=>x.id),['class-1']);
 assert.equal(visibleDemoClasses(c,'Student',{learnerId:'learner-p'}).length,0);
});
test('individual fictional learners can submit separate attempts, only for their selected identity',()=>{
 let s=assessment(),c=classes();
 const q=s.tasks.find(t=>t.id==='task-2');
 s=submitDemoQuiz(s,{classes:c,role:'Student',taskId:q.id,learnerId:'learner-a',
   answers:q.questions.map(x=>x.answer),previewLearnerId:'learner-a'});
 assert.throws(()=>submitDemoQuiz(s,{classes:c,role:'Student',taskId:q.id,learnerId:'learner-a',
   answers:q.questions.map(x=>x.answer),previewLearnerId:'learner-b'}),/selected sample learner/);
 const wrong=q.questions.map(x=>(x.answer+1)%x.options.length);
 s=submitDemoQuiz(s,{classes:c,role:'Student',taskId:q.id,learnerId:'learner-b',answers:wrong,previewLearnerId:'learner-b'});
 assert.equal(s.submissions.length,2);
 assert.equal(demoGradeRows(s,c,'Student',{learnerId:'learner-a'}).find(x=>x.taskId===q.id)?.points,3);
 assert.equal(demoGradeRows(s,c,'Student',{learnerId:'learner-b'}).find(x=>x.taskId===q.id)?.points,0);
 assert.deepEqual(visibleDemoTasks(s.tasks,c,'Student','quiz',{learnerId:'learner-p'}),[]);
});
test('selected instructor only grades and creates tasks for assigned sample groups',()=>{
 let s=assessment(),c=classes();
 assert.throws(()=>createDemoAssessment(s,{classes:c,terms:INITIAL_DEMO_TERMS,
   role:'Teacher',teacherId:'teacher-b',classId:'class-1',termId:'term-autumn-2026',
   kind:'project',title:'Class demo project',instructions:'Explain two details of this design.',dueDate:'2026-10-29'}),/not assigned/);
 s=createDemoAssessment(s,{classes:c,terms:INITIAL_DEMO_TERMS,
   role:'Teacher',teacherId:'teacher-b',classId:'class-2',termId:'term-autumn-2026',
   kind:'project',title:'Class demo project',instructions:'Explain two details of this design.',dueDate:'2026-10-29'});
 const sub=submitDemoProject(s,{classes:c,role:'Student',taskId:'task-3',learnerId:'learner-a',
   previewLearnerId:'learner-a',response:'A sample poster with clear contrast and one headline.'});
 assert.throws(()=>gradeDemoProject(sub,{classes:c,role:'Teacher',teacherId:'teacher-a',
   taskId:'task-3',learnerId:'learner-a',scores:{accuracy:4,clarity:3,completion:3},
   feedback:'Clear design choices in this sample.'}),/not assigned/);
 const marked=gradeDemoProject(sub,{classes:c,role:'Teacher',teacherId:'teacher-b',
   taskId:'task-3',learnerId:'learner-a',scores:{accuracy:4,clarity:3,completion:3},
   feedback:'Clear design choices in this sample.'});
 assert.equal(marked.submissions[0].points,10);
});
test('newly created fictional person can be renamed without changing IDs or class relationships',()=>{
 const teacher=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta');
 const renamed=renameDemoPerson(teacher,teacher.at(-1).id,'Sample Teacher Echo','teacher');
 assert.equal(renamed.at(-1).id,teacher.at(-1).id);
 assert.equal(renamed.at(-1).name,'Sample Teacher Echo');
 assert.equal(teacher.at(-1).name,'Sample Teacher Delta');
 assert.throws(()=>renameDemoPerson(teacher,'teacher-a','Sample Teacher New','teacher'),/Only added/);
 assert.throws(()=>renameDemoPerson(teacher,teacher.at(-1).id,'Sample Learner Bad','teacher'),/fictional/);
});
test('deactivation is reversible only for unassigned/unenrolled added sample people',()=>{
 let teachers=addDemoTeacher(DEMO_TEACHERS,'Sample Teacher Delta');
 let students=addDemoLearner(DEMO_LEARNERS,'Sample Learner Indigo');
 const teacherId=teachers.at(-1).id,learnerId=students.at(-1).id;
 assert.throws(()=>setDemoPersonActive(students,{id:learnerId,role:'learner',active:false,classes:classes(),guardians:[{id:'guardian-demo-1',learnerIds:[learnerId]}]}),/Unlink this fictional learner from guardians/);
 assert.throws(()=>setDemoPersonActive(teachers,{id:'teacher-a',role:'teacher',active:false,classes:classes()}),/Only newly/);
 teachers=setDemoPersonActive(teachers,{id:teacherId,role:'teacher',active:false,classes:classes()});
 assert.equal(activeDemoPeople(teachers).some(p=>p.id===teacherId),false);
 assert.throws(()=>assignDemoTeacher(classes(),'class-2',teacherId,activeDemoPeople(teachers)),/sample instructor/);
 teachers=setDemoPersonActive(teachers,{id:teacherId,role:'teacher',active:true,classes:classes()});
 assert.equal(activeDemoPeople(teachers).some(p=>p.id===teacherId),true);
 students=setDemoPersonActive(students,{id:learnerId,role:'learner',active:false,classes:classes()});
 assert.throws(()=>enrollDemoLearner(classes(),'class-1',learnerId,activeDemoPeople(students)),/fictional learner/);
 students=setDemoPersonActive(students,{id:learnerId,role:'learner',active:true,classes:classes()});
 const enrolled=enrollDemoLearner(classes(),'class-1',learnerId,students);
 assert.throws(()=>setDemoPersonActive(students,{id:learnerId,role:'learner',active:false,classes:enrolled}),/Remove student enrollments/);
 const assigned=assignDemoTeacher(classes(),'class-2',teacherId,teachers);
 assert.throws(()=>setDemoPersonActive(teachers,{id:teacherId,role:'teacher',active:false,classes:assigned}),/Reassign this teacher/);
});
test('browser preview identities are explicitly labeled not login, and changing identity remounts classroom screens',()=>{
 const src=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(src,/Selected fictional preview identity/);
 assert.match(src,/role\+'-'\+\(role==='Teacher'\?teacherId:learnerId\)/);
 assert.match(src,/activeDemoPeople\(teachers\)/);
 assert.match(src,/activeDemoPeople\(students\)/);
});
