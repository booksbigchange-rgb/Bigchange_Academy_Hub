/**
 * BigChange Academy M3 — independent fictional assessment workflow.
 * In-memory preview only. No verified identity or authorization, no persistent grades,
 * no real child data, no student uploads, no network calls.
 */
import { DEMO_COURSES, visibleDemoClasses } from './operations.mjs';

export const DEMO_RUBRIC = Object.freeze([
  {id:'accuracy',label:'Correct information',max:4},
  {id:'clarity',label:'Clear explanation',max:3},
  {id:'completion',label:'Task completion',max:3}
]);
export const DEMO_QUIZ_BANK = Object.freeze({
  computer:[
    {prompt:'Which component executes instructions?',options:['CPU','Keyboard','Monitor'],answer:0},
    {prompt:'What is RAM used for?',options:['Long-term backup','Temporary working memory','Cooling'],answer:1},
    {prompt:'Which can store files after shutdown?',options:['RAM','Cooling fan','SSD'],answer:2}
  ],
  creative:[
    {prompt:'What helps the main title stand out?',options:['Strong contrast','Random clutter','Tiny letters'],answer:0},
    {prompt:'Which layout is easier to read?',options:['No spacing','Clear grouping','Overlapping text'],answer:1}
  ],
  ai:[
    {prompt:'What makes a prompt clearer?',options:['Less context','Role and goal','Random words'],answer:1},
    {prompt:'What should you do with an uncertain AI answer?',options:['Verify it','Forward it','Trust it always'],answer:0}
  ],
  automation:[
    {prompt:'What starts an automation scenario?',options:['A trigger','A font','A screenshot'],answer:0},
    {prompt:'Why test a workflow?',options:['Make it longer','Catch errors','Hide inputs'],answer:1}
  ],
  scratch:[
    {prompt:'What starts code when the green flag is clicked?',options:['A costume','An event block','A color'],answer:1},
    {prompt:'What repeats commands?',options:['A loop','A backdrop','A name'],answer:0}
  ]
});

export const INITIAL_DEMO_ASSESSMENTS={
  tasks:[
    {id:'task-1',classId:'class-1',termId:'term-autumn-2026',kind:'project',title:'Identify computer parts',instructions:'Describe the CPU, RAM and SSD, and explain what each component does.',dueDate:'2026-10-28',rubric:DEMO_RUBRIC.map(x=>({...x})),questions:[]},
    {id:'task-2',classId:'class-1',termId:'term-autumn-2026',kind:'quiz',title:'Computer hardware check',instructions:'Choose one answer for each question. This sample quiz is auto-marked.',dueDate:'2026-10-30',rubric:[],questions:DEMO_QUIZ_BANK.computer.map(x=>({...x,options:[...x.options]}))},
    {id:'task-3',classId:'class-2',termId:'term-autumn-2026',kind:'project',title:'Design a sample event poster',instructions:'Describe an imaginative event poster using one headline and a clear color palette.',dueDate:'2026-10-29',rubric:DEMO_RUBRIC.map(x=>({...x})),questions:[]}
  ],
  submissions:[],
  gradeHistory:[]
};
function assertRole(role,classes,classId,teacherId='teacher-a'){
  if(role!=='Teacher'&&role!=='Administrator')throw Error('Only educator preview roles can perform this action');
  if(!visibleDemoClasses(classes,role,{teacherId}).some(c=>c.id===classId))throw Error('This sample group is not assigned to this educator view');
}
function findTask(tasks,taskId){
  const task=tasks.find(t=>t.id===taskId);
  if(!task)throw Error('Unknown assessment');
  return task;
}
function findGroup(classes,classId){
  const classroom=classes.find(c=>c.id===classId);
  if(!classroom)throw Error('Unknown class group');
  return classroom;
}
function assertLearner(classes,task,learnerId){
  if(!findGroup(classes,task.classId).learnerIds.includes(learnerId))throw Error('Fictional learner is not enrolled in the task class');
}
function assertDemoStudent(role,learnerId,previewLearnerId='learner-a'){
  if(role!=='Student'||learnerId!==previewLearnerId)throw Error('Only the currently selected sample learner can submit');
}
function validateProjectResponse(text){
  if(typeof text!=='string'||text.trim().length<15||text.trim().length>800)
    throw Error('Write a sample response of 15–800 characters');
}
function isoDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function createDemoAssessment(state,{classes,terms,role,classId,termId,kind,title,instructions,dueDate,teacherId='teacher-a',courses=DEMO_COURSES}){
  assertRole(role,classes,classId,teacherId);
  const classroom=findGroup(classes,classId);
  const term=terms.find(t=>t.id===termId);
  if(!term)throw Error('Choose an existing sample academic term');
  if(!isoDate(dueDate)||dueDate<term.start||dueDate>term.end)throw Error('Due date must fall inside the chosen academic term');
  if(!['project','quiz'].includes(kind))throw Error('Choose a valid assessment type');
  if(typeof title!=='string'||title.trim().length<5||title.trim().length>90)throw Error('Title must contain 5–90 characters');
  if(typeof instructions!=='string'||instructions.trim().length<15||instructions.trim().length>500)throw Error('Instructions must contain 15–500 characters');
  if(state.tasks.filter(t=>t.classId===classId&&t.termId===termId).length>=30)throw Error('This class already has 30 sample tasks');
  if(state.tasks.some(t=>t.classId===classId&&t.termId===termId&&t.title.toLowerCase()===title.trim().toLowerCase()))throw Error('The class already has a task with this title');
  const course=courses.find(c=>c.id===classroom.courseId);
  if(!course)throw Error('Choose a course in the catalog for this class');
  const quiz=course.quizQuestions??DEMO_QUIZ_BANK[classroom.courseId]??[];
  if(kind==='quiz'&&!quiz.length)throw Error('No quiz bank available for this subject');
  const used=new Set(state.tasks.map(t=>t.id));let n=1;while(used.has('task-'+n))n++;
  const task={
    id:'task-'+n,classId,termId,kind,title:title.trim(),instructions:instructions.trim(),dueDate,
    rubric:kind==='project'?DEMO_RUBRIC.map(x=>({...x})):[],
    questions:kind==='quiz'?quiz.map(q=>({...q,options:[...q.options]})):[]
  };
  return {...state,tasks:[...state.tasks,task]};
}

/**
 * Edit only stable task metadata. Questions and rubrics remain unchanged so prior
 * submissions keep their meaning. Only an assigned educator may revise this demo task.
 */
export function reviseDemoAssessment(state,{classes,terms,role,taskId,title,instructions,dueDate,teacherId='teacher-a'}){
  const task=findTask(state.tasks,taskId);
  assertRole(role,classes,task.classId,teacherId);
  const term=terms.find(t=>t.id===task.termId);
  if(!term)throw Error('The task’s academic term no longer exists');
  if(!isoDate(dueDate)||dueDate<term.start||dueDate>term.end)
    throw Error('Due date must fall inside the task’s academic term');
  if(typeof title!=='string'||title.trim().length<5||title.trim().length>90)
    throw Error('Title must contain 5–90 characters');
  if(typeof instructions!=='string'||instructions.trim().length<15||instructions.trim().length>500)
    throw Error('Instructions must contain 15–500 characters');
  if(state.tasks.some(t=>t.id!==taskId&&t.classId===task.classId&&t.termId===task.termId
      &&t.title.toLowerCase()===title.trim().toLowerCase()))
    throw Error('This class already has another task with that title');
  return {...state,tasks:state.tasks.map(t=>t.id===taskId
    ?{...t,title:title.trim(),instructions:instructions.trim(),dueDate}
    :t)};
}
export function submitDemoProject(state,{classes,role,taskId,learnerId,response,previewLearnerId='learner-a'}){
  assertDemoStudent(role,learnerId,previewLearnerId);
  const task=findTask(state.tasks,taskId);
  if(task.kind!=='project')throw Error('This is not a project task');
  assertLearner(classes,task,learnerId);
  if(state.submissions.some(s=>s.taskId===taskId&&s.learnerId===learnerId))throw Error('Already submitted; this sample task can only be submitted once');
  validateProjectResponse(response);
  return {...state,submissions:[...state.submissions,{
    taskId,learnerId,response:response.trim(),answers:[],status:'submitted',points:null,maxPoints:task.rubric.reduce((sum,c)=>sum+c.max,0),
    rubricScores:null,feedback:''
  }]};
}
export function submitDemoQuiz(state,{classes,role,taskId,learnerId,answers,previewLearnerId='learner-a'}){
  assertDemoStudent(role,learnerId,previewLearnerId);
  const task=findTask(state.tasks,taskId);
  if(task.kind!=='quiz')throw Error('This is not a quiz');
  assertLearner(classes,task,learnerId);
  if(state.submissions.some(s=>s.taskId===taskId&&s.learnerId===learnerId))throw Error('You already completed this sample quiz');
  if(!Array.isArray(answers)||answers.length!==task.questions.length||answers.some((x,i)=>!Number.isInteger(x)||x<0||x>=task.questions[i].options.length))
    throw Error('Answer every multiple-choice question before submitting');
  const points=task.questions.filter((q,i)=>q.answer===answers[i]).length;
  return {...state,submissions:[...state.submissions,{
    taskId,learnerId,response:'',answers:[...answers],status:'graded',points,maxPoints:task.questions.length,rubricScores:null,
    feedback:'Automatically scored in this fictional demonstration'
  }]};
}
export function gradeDemoProject(state,{classes,role,taskId,learnerId,scores,feedback,teacherId='teacher-a'}){
  const task=findTask(state.tasks,taskId);
  assertRole(role,classes,task.classId,teacherId);
  if(task.kind!=='project')throw Error('Only project tasks use the manual rubric');
  assertLearner(classes,task,learnerId);
  const old=state.submissions.find(s=>s.taskId===taskId&&s.learnerId===learnerId);
  if(!old)throw Error('Wait for a sample submission before grading');
  if(!scores||typeof scores!=='object'||Array.isArray(scores)||Object.keys(scores).length!==task.rubric.length
    ||task.rubric.some(c=>!Number.isInteger(scores[c.id])||scores[c.id]<0||scores[c.id]>c.max))
    throw Error('Enter a whole-number rubric score for every criterion, within its maximum');
  if(typeof feedback!=='string'||feedback.trim().length<8||feedback.trim().length>300)throw Error('Feedback must contain 8–300 characters');
  const points=task.rubric.reduce((sum,c)=>sum+scores[c.id],0);
  const newSubmission={...old,status:'graded',points,maxPoints:task.rubric.reduce((sum,c)=>sum+c.max,0),
    rubricScores:{...scores},feedback:feedback.trim()};
  const newHistory={sequence:state.gradeHistory.length+1,taskId,learnerId,from:old.points,to:points};
  return {...state,submissions:state.submissions.map(s=>s===old?newSubmission:s),
    gradeHistory:[...state.gradeHistory,newHistory]};
}
export function visibleDemoTasks(tasks,classes,role,kind,identity={}){
  const ids=new Set(visibleDemoClasses(classes,role,identity).map(c=>c.id));
  return tasks.filter(t=>ids.has(t.classId)&&(!kind||t.kind===kind));
}
export function demoGradeRows(state,classes,role,identity={}){
  const tasks=visibleDemoTasks(state.tasks,classes,role,undefined,identity);
  return tasks.flatMap(task=>{
    const room=findGroup(classes,task.classId);
    const ids=role==='Student'?room.learnerIds.filter(id=>id===(identity.learnerId??'learner-a')):room.learnerIds;
    return ids.map(learnerId=>{
      const sub=state.submissions.find(s=>s.taskId===task.id&&s.learnerId===learnerId);
      return {taskId:task.id,classId:task.classId,learnerId,title:task.title,kind:task.kind,
        status:sub?.status??'not submitted',points:sub?.points??null,maxPoints:task.kind==='quiz'?task.questions.length:task.rubric.reduce((sum,c)=>sum+c.max,0)};
    });
  });
}
export function demoProgress(rows){
  const graded=rows.filter(x=>x.status==='graded'&&x.maxPoints>0);
  const percentage=graded.length?Math.round(graded.reduce((sum,x)=>sum+x.points/x.maxPoints,0)/graded.length*100):null;
  return {assigned:rows.length,submitted:rows.filter(x=>x.status!=='not submitted').length,
    graded:graded.length,awaitingReview:rows.filter(x=>x.status==='submitted').length,percentage};
}
