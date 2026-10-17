/** M5 fictional, aggregate-only reporting. No real authorization, enrollment history or audit. */
import {DEMO_COURSES,DEMO_TEACHERS} from './operations.mjs';
const label=(array,id)=>array.find(x=>x.id===id)?.name??'Unknown';
function check(value,values,name){if(value!=='all'&&!values.includes(value))throw Error('Unknown '+name+' filter');}
function attendance(sessions,classes,marks){
 const groupMap=new Map(classes.map(c=>[c.id,c])),lookup=new Map(marks.map(m=>[m.sessionId+':'+m.learnerId,m.status]));
 const result={opportunities:0,present:0,late:0,absent:0,excused:0,unmarked:0,markedRate:null};
 for(const s of sessions){const c=groupMap.get(s.classId);if(!c)continue;
  for(const learner of c.learnerIds){result.opportunities++;const status=lookup.get(s.id+':'+learner);
   if(['Present','Late','Absent','Excused'].includes(status))result[status.toLowerCase()]++;
   else result.unmarked++;
  }
 }
 const denominator=result.present+result.late+result.absent;
 result.markedRate=denominator?Math.round(100*(result.present+result.late)/denominator):null;
 return result;
}
function assessmentTotals(tasks,groups,submissions){
 const map=new Map(groups.map(c=>[c.id,c])),subMap=new Map(submissions.map(s=>[s.taskId+':'+s.learnerId,s]));
 let assigned=0,submitted=0,awaitingReview=0,graded=0,scoreSum=0;
 for(const t of tasks){const room=map.get(t.classId);if(!room)continue;
  const max=t.kind==='quiz'?t.questions.length:t.rubric.reduce((sum,r)=>sum+r.max,0);
  for(const id of room.learnerIds){assigned++;const submission=subMap.get(t.id+':'+id);
   if(submission){submitted++;if(submission.status==='submitted')awaitingReview++;
    if(submission.status==='graded'&&max>0&&Number.isFinite(submission.points)&&submission.points>=0&&submission.points<=max){
      graded++;scoreSum+=submission.points/max;
    }
   }
  }
 }
 return {assigned,submitted,awaitingReview,graded,average:graded?Math.round(100*scoreSum/graded):null};
}
function reconcile(ledger,period){
 const valid=[],exceptions=[];
 for(const [index,row] of ledger.entries()){if(period!=='all'&&row.period!==period)continue;
  if(!Number.isSafeInteger(row.due)||!Number.isSafeInteger(row.recorded)||row.due<0||row.recorded<0||row.recorded>row.due){
   exceptions.push({index,reason:'Invalid, negative or excessive payment'});continue;
  }valid.push(row);
 }
 const sum=rows=>({due:rows.reduce((s,r)=>s+r.due,0),recorded:rows.reduce((s,r)=>s+r.recorded,0),
   outstanding:rows.reduce((s,r)=>s+r.due-r.recorded,0),rows:rows.length,
   paid:rows.filter(r=>r.recorded===r.due).length,partial:rows.filter(r=>r.recorded>0&&r.recorded<r.due).length,
   unpaid:rows.filter(r=>r.recorded===0&&r.due>0).length});
 const periods=[...new Set(valid.map(r=>r.period))].sort().map(name=>({name,...sum(valid.filter(r=>r.period===name))}));
 return {...sum(valid),periods,exceptions};
}
/** Academic scope is by term/course/teacher. Finance is ONLY by payment period. */
export function summarizeDemoAcademy({classes,academic,assessments,ledger,termId='all',courseId='all',teacherId='all',period='all',teachers=DEMO_TEACHERS}){
 check(termId,academic.terms.map(x=>x.id),'term');check(courseId,DEMO_COURSES.map(x=>x.id),'course');
 check(teacherId,teachers.map(x=>x.id),'teacher');check(period,ledger.map(x=>x.period),'payment period');
 const groups=classes.filter(c=>(courseId==='all'||c.courseId===courseId)&&(teacherId==='all'||c.teacherId===teacherId));
 const ids=new Set(groups.map(c=>c.id)),students=new Set(groups.flatMap(c=>c.learnerIds));
 const sessions=academic.sessions.filter(s=>ids.has(s.classId)&&(termId==='all'||s.termId===termId));
 const tasks=assessments.tasks.filter(t=>ids.has(t.classId)&&(termId==='all'||t.termId===termId));
 const capacity=groups.reduce((s,c)=>s+c.capacity,0),enrollments=groups.reduce((s,c)=>s+c.learnerIds.length,0);
 const classRows=groups.map(c=>{
  const cs=sessions.filter(s=>s.classId===c.id),ts=tasks.filter(t=>t.classId===c.id);
  return {id:c.id,course:label(DEMO_COURSES,c.courseId),courseId:c.courseId,teacher:label(teachers,c.teacherId),
   teacherId:c.teacherId,slot:c.slot,learners:c.learnerIds.length,capacity:c.capacity,
   utilization:c.capacity?Math.round(c.learnerIds.length/c.capacity*100):0,sessions:cs.length,
   attendance:attendance(cs,[c],academic.attendance),grades:assessmentTotals(ts,[c],assessments.submissions)};
 });
 const teacherRows=teachers.filter(t=>teacherId==='all'||teacherId===t.id).map(t=>{
  const own=groups.filter(c=>c.teacherId===t.id);
  return {id:t.id,name:t.name,groups:own.length,weeklySessions:2*own.length,
   enrollments:own.reduce((s,c)=>s+c.learnerIds.length,0),uniqueLearners:new Set(own.flatMap(c=>c.learnerIds)).size,
   plannedSessions:sessions.filter(s=>own.some(c=>c.id===s.classId)).length};
 });
 const courseRows=DEMO_COURSES.filter(c=>courseId==='all'||courseId===c.id).map(c=>{
  const own=groups.filter(g=>g.courseId===c.id),cap=own.reduce((s,g)=>s+g.capacity,0),enrl=own.reduce((s,g)=>s+g.learnerIds.length,0);
  return {id:c.id,name:c.name,groups:own.length,enrollments:enrl,capacity:cap,utilization:cap?Math.round(100*enrl/cap):0};
 });
 return {
  filters:{termId,courseId,teacherId,period},
  summary:{classes:groups.length,uniqueLearners:students.size,enrollments,capacity,
   utilization:capacity?Math.round(100*enrollments/capacity):0,activeTeachers:teacherRows.filter(x=>x.groups).length,
   activeCourses:courseRows.filter(x=>x.groups).length,plannedSessions:sessions.length},
  attendance:attendance(sessions,groups,academic.attendance),grades:assessmentTotals(tasks,groups,assessments.submissions),
  fees:reconcile(ledger,period),classRows,teacherRows,courseRows,historicalEnrollmentAvailable:false
 };
}
/** Neutralize spreadsheet formulas even if prefixed with whitespace. */
export function safeCsvCell(x){
 const s=String(x??'');const value=/^\s*[=+\-@]/.test(s)?'\''+s:s;
 return '"'+value.replace(/"/g,'""')+'"';
}
/** No individual learner/guardian identifiers or transaction-level records. */
export function demoAggregateCsv(report){
 const rows=[['Section','Name','Metric','Value','Scope']];
 const add=(section,name,metric,value,scope)=>rows.push([section,name,metric,value,scope]);
 const a='term='+report.filters.termId+'; course='+report.filters.courseId+'; teacher='+report.filters.teacherId;
 const f='paymentPeriod='+report.filters.period;
 for(const [k,v] of Object.entries(report.summary))add('Academics','All groups',k,v,a);
 for(const row of report.classRows)for(const k of ['learners','capacity','utilization','sessions'])
   add('Class',row.id+' / '+row.course+' / '+row.teacher,k,row[k],a);
 for(const row of report.teacherRows)for(const k of ['groups','enrollments','uniqueLearners','weeklySessions'])
   add('Teachers',row.name,k,row[k],a);
 for(const row of report.courseRows)for(const k of ['groups','enrollments','capacity','utilization'])
   add('Courses',row.name,k,row[k],a);
 for(const k of ['opportunities','present','late','absent','excused','unmarked','markedRate'])
   add('Attendance','Class groups',k,report.attendance[k],a);
 for(const k of ['assigned','submitted','awaitingReview','graded','average'])
   add('Assessments','Class groups',k,report.grades[k],a);
 for(const k of ['due','recorded','outstanding','rows','paid','partial','unpaid'])
   add('External fees','Academy ledger',k,report.fees[k],f);
 for(const row of report.fees.periods)for(const k of ['due','recorded','outstanding'])
   add('External fees',row.name,k,row[k],f);
 add('Reconciliation','Exception count','invalidRows',report.fees.exceptions.length,f);
 return '\uFEFF'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n')+'\r\n';
}
