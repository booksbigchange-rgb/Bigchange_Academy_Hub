import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_DEMO_CLASSES,createDemoClass} from '../src/lib/operations.mjs';
import {INITIAL_DEMO_TERMS} from '../src/lib/academics.mjs';
import {
  INITIAL_DEMO_ASSESSMENTS,DEMO_RUBRIC,createDemoAssessment,submitDemoProject,submitDemoQuiz,
  gradeDemoProject,visibleDemoTasks,demoGradeRows,demoProgress
} from '../src/lib/assessments.mjs';
const groups=()=>structuredClone(INITIAL_DEMO_CLASSES);
const state=()=>structuredClone(INITIAL_DEMO_ASSESSMENTS);
const options={classes:groups(),terms:structuredClone(INITIAL_DEMO_TERMS),role:'Teacher',
  classId:'class-1',termId:'term-autumn-2026',kind:'project',
  title:'Hardware mini reflection',instructions:'Explain the function of two fictional computer parts.',dueDate:'2026-11-02'};
test('class and term binding rejects unauthorized demo educator, bad dates and duplicate titles',()=>{
  const s=state();
  const next=createDemoAssessment(s,options);
  assert.equal(next.tasks.length,s.tasks.length+1);
  assert.equal(s.tasks.length,3);
  assert.equal(next.tasks.at(-1).rubric.reduce((sum,x)=>sum+x.max,0),10);
  assert.throws(()=>createDemoAssessment(s,{...options,role:'Student'}),/educator/);
  assert.throws(()=>createDemoAssessment(s,{...options,classId:'class-2'}),/not assigned/);
  assert.throws(()=>createDemoAssessment(s,{...options,dueDate:'2026-02-30'}),/Due date/);
  assert.throws(()=>createDemoAssessment(s,{...options,dueDate:'2027-02-03'}),/Due date/);
  assert.throws(()=>createDemoAssessment(s,{...options,title:'Identify computer parts'}),/already has/);
});
test('quiz creation uses class course question bank, independent copy and valid date',()=>{
  const s=state(),next=createDemoAssessment(s,{...options,kind:'quiz',title:'Practice mini quiz'});
  assert.ok(next.tasks.at(-1).questions.length>0);
  assert.equal(next.tasks.at(-1).classId,'class-1');
  assert.equal(next.tasks.at(-1).rubric.length,0);
  assert.equal(s.tasks.length,3);
});
test('students submit exactly once to their enrolled class, never outside their role',()=>{
  const s=state(),response='The CPU runs instructions and SSD keeps saved files.';
  const result=submitDemoProject(s,{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',response});
  assert.equal(result.submissions[0].status,'submitted');
  assert.equal(result.submissions[0].points,null);
  assert.equal(s.submissions.length,0);
  assert.throws(()=>submitDemoProject(result,{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',response}),/Already submitted/);
  assert.throws(()=>submitDemoProject(s,{classes:groups(),role:'Teacher',taskId:'task-1',learnerId:'learner-a',response}),/learner-A/);
  assert.throws(()=>submitDemoProject(s,{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',response:'too short'}),/15/);
  const assigned=createDemoAssessment(s,{...options,kind:'project',classId:'class-3',role:'Administrator'});
  assert.throws(()=>submitDemoProject(assigned,{classes:groups(),role:'Student',
    taskId:assigned.tasks.at(-1).id,learnerId:'learner-a',response}),/not enrolled/);
});
test('quiz auto-scores correct and incorrect answers, rejects incomplete and repeat attempts',()=>{
  const s=state(),quiz=s.tasks.find(t=>t.id==='task-2');
  const answers=quiz.questions.map(q=>q.answer);
  const result=submitDemoQuiz(s,{classes:groups(),role:'Student',taskId:quiz.id,learnerId:'learner-a',answers});
  assert.equal(result.submissions[0].points,quiz.questions.length);
  assert.equal(result.submissions[0].status,'graded');
  assert.throws(()=>submitDemoQuiz(s,{classes:groups(),role:'Student',taskId:quiz.id,learnerId:'learner-a',answers:[0]}),/Answer every/);
  assert.throws(()=>submitDemoQuiz(s,{classes:groups(),role:'Student',taskId:quiz.id,learnerId:'learner-a',answers:[-1,1,2]}),/Answer every/);
  assert.throws(()=>submitDemoQuiz(result,{classes:groups(),role:'Student',taskId:quiz.id,learnerId:'learner-a',answers}),/already completed/);
  const wrong=quiz.questions.map(q=>(q.answer+1)%q.options.length);
  const zero=submitDemoQuiz(s,{classes:groups(),role:'Student',taskId:quiz.id,learnerId:'learner-a',answers:wrong});
  assert.equal(zero.submissions[0].points,0);
});
test('rubric grading is bounded, teacher-controlled and keeps browser-only correction history',()=>{
  const submitted=submitDemoProject(state(),{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',
    response:'CPU is the processor; RAM is temporary and SSD stores files.'});
  const scores={accuracy:4,clarity:2,completion:3};
  const graded=gradeDemoProject(submitted,{classes:groups(),role:'Teacher',taskId:'task-1',learnerId:'learner-a',
    scores,feedback:'Good explanation with a clear structure.'});
  assert.equal(graded.submissions[0].points,9);
  assert.equal(submitted.submissions[0].status,'submitted');
  assert.equal(graded.gradeHistory.length,1);
  assert.deepEqual([graded.gradeHistory[0].from,graded.gradeHistory[0].to],[null,9]);
  const corrected=gradeDemoProject(graded,{classes:groups(),role:'Administrator',taskId:'task-1',learnerId:'learner-a',
    scores:{accuracy:3,clarity:2,completion:3},feedback:'Rechecked the answer; one item was unclear.'});
  assert.deepEqual([corrected.gradeHistory[1].from,corrected.gradeHistory[1].to],[9,8]);
  assert.throws(()=>gradeDemoProject(submitted,{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',scores,feedback:'Valid feedback'}),/educator/);
  assert.throws(()=>gradeDemoProject(submitted,{classes:groups(),role:'Teacher',taskId:'task-1',learnerId:'learner-a',
    scores:{accuracy:5,clarity:2,completion:3},feedback:'Valid feedback'}),/rubric/);
  assert.throws(()=>gradeDemoProject(submitted,{classes:groups(),role:'Teacher',taskId:'task-1',learnerId:'learner-a',
    scores:{accuracy:4,clarity:2},feedback:'Valid feedback'}),/rubric/);
  assert.throws(()=>gradeDemoProject(submitted,{classes:groups(),role:'Teacher',taskId:'task-2',learnerId:'learner-a',scores,feedback:'Valid feedback'}),/Only project/);
});
test('teacher cannot grade other teacher groups even with an existing fake submission',()=>{
  const s=state();
  s.submissions.push({taskId:'task-3',learnerId:'learner-a',response:'Sample design response for a classroom example.',answers:[],status:'submitted',
    points:null,maxPoints:10,rubricScores:null,feedback:''});
  assert.throws(()=>gradeDemoProject(s,{classes:groups(),role:'Teacher',taskId:'task-3',learnerId:'learner-a',
    scores:{accuracy:3,clarity:3,completion:3},feedback:'Good effort in this project.'}),/not assigned/);
});
test('grade views restrict to visible sample classes and only enrolled learners',()=>{
  const s=state(),all=demoGradeRows(s,groups(),'Administrator'),teacher=demoGradeRows(s,groups(),'Teacher'),student=demoGradeRows(s,groups(),'Student');
  assert.ok(all.length>teacher.length);
  assert.ok(teacher.length>=student.length);
  assert.ok(student.every(row=>row.learnerId==='learner-a'));
  assert.equal(visibleDemoTasks(s.tasks,groups(),'Teacher').some(t=>t.classId==='class-2'),false);
  assert.equal(visibleDemoTasks(s.tasks,groups(),'Student','quiz').length,1);
  const summary=demoProgress(student);
  assert.equal(summary.graded,0);
  assert.equal(summary.percentage,null);
  assert.equal(summary.assigned,3);
});
test('grade progress includes graded submissions only and not missing work',()=>{
  let s=state();
  s=submitDemoQuiz(s,{classes:groups(),role:'Student',taskId:'task-2',learnerId:'learner-a',answers:[0,1,2]});
  s=submitDemoProject(s,{classes:groups(),role:'Student',taskId:'task-1',learnerId:'learner-a',
    response:'A fictional student identifies three computer components.'});
  const rows=demoGradeRows(s,groups(),'Student');
  const summary=demoProgress(rows);
  assert.equal(summary.assigned,3);
  assert.equal(summary.submitted,2);
  assert.equal(summary.graded,1);
  assert.equal(summary.awaitingReview,1);
  assert.equal(summary.percentage,100);
  assert.equal(DEMO_RUBRIC.reduce((total,x)=>total+x.max,0),10);
});
