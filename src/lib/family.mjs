/**
 * Fictional guardian-child links for UI prototyping only.
 * WARNING: In production these relationships MUST be verified server-side.
 * Browser-side filtering and role previews provide NO privacy boundary.
 */
export const DEMO_GUARDIANS=Object.freeze([
  {id:'guardian-a',name:'Guardian A',learnerIds:['learner-a','learner-c']},
  {id:'guardian-b',name:'Guardian B',learnerIds:['learner-b']}
]);
export function demoGuardianProfile(guardianId){
  const match=DEMO_GUARDIANS.find(g=>g.id===guardianId);
  return match?{id:match.id,name:match.name,learnerIds:[...match.learnerIds]}:null;
}
export function demoGuardianChildren(guardianId){
  const match=demoGuardianProfile(guardianId);
  return match?.learnerIds??[];
}
/**
 * @param {{guardianId:string,learnerId:string,classes:Array,
 * academic:{sessions:Array,attendance:Array},assessment:{tasks:Array,submissions:Array},ledger:Array}} opts
 */
export function demoFamilyReport({guardianId,learnerId,classes,academic,assessment,ledger}){
  const guardian=demoGuardianProfile(guardianId);
  if(!guardian)throw Error('Unknown fictional guardian');
  if(!guardian.learnerIds.includes(learnerId))throw Error('This learner is not linked to the fictional guardian');
  const enrolled=classes.filter(c=>c.learnerIds.includes(learnerId));
  const classIds=new Set(enrolled.map(c=>c.id));
  const lessons=academic.sessions.filter(s=>classIds.has(s.classId))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
    .map(s=>{
      const row=academic.attendance.find(a=>a.sessionId===s.id&&a.learnerId===learnerId);
      return {id:s.id,classId:s.classId,date:s.date,topic:s.topic,status:row?.status??'Unmarked'};
    });
  const assigned=assessment.tasks.filter(t=>classIds.has(t.classId))
    .sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id))
    .map(t=>{
      const sub=assessment.submissions.find(s=>s.taskId===t.id&&s.learnerId===learnerId);
      const maxPoints=t.kind==='quiz'?t.questions.length:t.rubric.reduce((sum,r)=>sum+r.max,0);
      return {id:t.id,classId:t.classId,kind:t.kind,title:t.title,dueDate:t.dueDate,
        status:sub?.status??'not submitted',points:sub?.points??null,maxPoints,
        feedback:sub?.status==='graded'?sub.feedback:''
      };
    });
  const scored=assigned.filter(t=>t.status==='graded'&&t.points!==null&&t.maxPoints>0);
  const scoreAverage=scored.length?Math.round(scored.reduce((total,t)=>total+100*t.points/t.maxPoints,0)/scored.length):null;
  const ledgerRows=ledger.filter(row=>row.learnerId===learnerId&&row.guardianId===guardianId)
    .map(row=>({period:row.period,due:row.due,recorded:row.recorded,
      outstanding:Math.max(0,row.due-row.recorded),status:row.recorded>=row.due?'Paid':row.recorded>0?'Partial':'Unpaid'}));
  const counted=lessons.filter(s=>['Present','Absent','Late'].includes(s.status));
  const attended=counted.filter(s=>s.status==='Present'||s.status==='Late').length;
  return {
    guardianName:guardian.name,learnerId,
    classIds:[...classIds],classCount:enrolled.length,lessons,assigned,ledgerRows,
    attendance:{attended,marked:counted.length,excused:lessons.filter(s=>s.status==='Excused').length,
      unmarked:lessons.filter(s=>s.status==='Unmarked').length,scheduled:lessons.length},
    progress:{assigned:assigned.length,submitted:assigned.filter(t=>t.status!=='not submitted').length,
      graded:scored.length,awaitingReview:assigned.filter(t=>t.status==='submitted').length,average:scoreAverage},
    fees:{due:ledgerRows.reduce((sum,r)=>sum+r.due,0),
      recorded:ledgerRows.reduce((sum,r)=>sum+r.recorded,0),
      outstanding:ledgerRows.reduce((sum,r)=>sum+r.outstanding,0)}
  };
}
