/**
 * QA: keep ALL four fictional role dashboards consistent with M1–M5 data.
 * This is an in-browser illustration, NOT authentication or persisted reporting.
 */
import {DEMO_COURSES,DEMO_TEACHERS,DEMO_LEARNERS,visibleDemoClasses} from './operations.mjs';
import {summarizeDemoAcademy} from './reporting.mjs';
const NAV=['Overview','Courses','Classes','Directory','Timetable','Lessons','Assignments',
  'Quizzes','Grades','Attendance','Finance','Reports','Family'];
export function demoSidebarSections(role){
  if(role==='Guardian')return ['Overview','Family'];
  if(role==='Administrator')return NAV.filter(s=>s!=='Family');
  if(role==='Teacher')return NAV.filter(s=>s!=='Finance'&&s!=='Reports'&&s!=='Family');
  if(role==='Student')return NAV.filter(s=>!['Finance','Reports','Family','Directory'].includes(s));
  return [];
}
const descriptors={
 computer:{topic:'Hardware, files and basic troubleshooting',icon:'◈',activity:'Identify the CPU, RAM and SSD in a computer diagram.'},
 creative:{topic:'Canva, layout and visual storytelling',icon:'✳',activity:'Design a poster with three colors and one clear headline.'},
 ai:{topic:'Prompt engineering and responsible AI',icon:'✦',activity:'Improve a vague prompt by adding the role, task and audience.'},
 automation:{topic:'Spreadsheets, webhooks and simple workflows',icon:'⌘',activity:'Outline the steps of a sample homework-help automation.'},
 scratch:{topic:'Creative stories, games and digital logic',icon:'▧',activity:'Plan a short interactive story with two sprites.'}
};
export function demoVisibleCourses(role,classes){
  const visible=visibleDemoClasses(classes,role);
  if(role==='Guardian'||!['Student','Teacher','Administrator'].includes(role))return [];
  return DEMO_COURSES.filter(c=>role==='Administrator'||visible.some(v=>v.courseId===c.id)).map(c=>{
    const n=visible.filter(v=>v.courseId===c.id).length;
    return {id:c.id,title:c.name,topic:descriptors[c.id].topic,icon:descriptors[c.id].icon,
      activity:descriptors[c.id].activity,
      groupCount:n,courseStat:n+' '+(n===1?'group':'groups'),
      statNote:role==='Administrator'?'Current groups':'Linked fictional classes'};
  });
}
function attendanceForLearner(classes,academic,learnerId){
 const ids=new Set(classes.filter(c=>c.learnerIds.includes(learnerId)).map(c=>c.id));
 const sessions=academic.sessions.filter(s=>ids.has(s.classId));
 const attendance=sessions.map(s=>academic.attendance.find(a=>a.sessionId===s.id&&a.learnerId===learnerId)?.status??'Unmarked');
 const marked=attendance.filter(s=>s!=='Unmarked').length;
 return {scheduled:attendance.length,marked,unmarked:attendance.length-marked};
}
function nonSubmittedTasks(classes,assessments,learnerId){
 const ids=new Set(classes.filter(c=>c.learnerIds.includes(learnerId)).map(c=>c.id));
 const assigned=assessments.tasks.filter(t=>ids.has(t.classId));
 const submitted=new Set(assessments.submissions.filter(s=>s.learnerId===learnerId).map(s=>s.taskId));
 return {assigned:assigned.length,due:assigned.filter(t=>!submitted.has(t.id)).length,
   submitted:assigned.length-assigned.filter(t=>!submitted.has(t.id)).length};
}
const card=(title,value,subtitle,icon)=>({title,value:String(value),subtitle,icon});
export function demoOverviewCards(role,{classes,academic,assessments,ledger,teachers=DEMO_TEACHERS,students=DEMO_LEARNERS}){
 if(role==='Guardian'||!['Administrator','Student','Teacher'].includes(role))return [];
 if(role==='Administrator'){
  const r=summarizeDemoAcademy({classes,academic,assessments,ledger,teachers});
  return [
   card('Registered students',students.length,r.summary.uniqueLearners+' enrolled in a class','♧'),
   card('Teachers',teachers.length,r.summary.activeTeachers+' assigned to class groups','✳'),
   card('Class groups',r.summary.classes,r.summary.activeCourses+' courses with groups','▣'),
   card('Balances due','ETB '+r.fees.outstanding.toLocaleString('en-US'),'Offline example ledger only','◈')
  ];
 }
 const visible=visibleDemoClasses(classes,role);
 const ids=new Set(visible.map(c=>c.id));
 if(role==='Student'){
  const homework=nonSubmittedTasks(classes,assessments,'learner-a');
  const attendance=attendanceForLearner(classes,academic,'learner-a');
  return [
   card('My classes',visible.length,'Fictional Learner A group membership','▣'),
   card('Assignments to do',homework.due,homework.assigned+' assigned in my groups','◫'),
   card('Submitted work',homework.submitted,'Projects and quizzes combined','✎'),
   card('Attendance recorded',attendance.marked+' / '+attendance.scheduled,
    attendance.unmarked+' lesson marks not entered','◷')
  ];
 }
 const unique=new Set(visible.flatMap(c=>c.learnerIds)).size;
 const submissions=assessments.submissions.filter(s=>s.status==='submitted'&&
   assessments.tasks.some(t=>t.id===s.taskId&&ids.has(t.classId))&&
   visible.some(c=>c.learnerIds.includes(s.learnerId)&&assessments.tasks.some(t=>t.id===s.taskId&&t.classId===c.id)));
 const sessions=academic.sessions.filter(s=>ids.has(s.classId));
 const registered=sessions.reduce((sum,s)=>{
  const roster=visible.find(c=>c.id===s.classId)?.learnerIds??[];
  return sum+roster.filter(id=>academic.attendance.some(a=>a.sessionId===s.id&&a.learnerId===id)).length;
 },0);
 const opportunities=sessions.reduce((sum,s)=>sum+(visible.find(c=>c.id===s.classId)?.learnerIds.length??0),0);
 return [
  card('My teaching groups',visible.length,'Instructor A sample assignments','▣'),
  card('Unique learners',unique,'Across these teaching groups','♧'),
  card('To review',submissions.length,'Submitted written projects','◫'),
  card('Register marks',registered+' / '+opportunities,'Marked learner-session opportunities','◷')
 ];
}
