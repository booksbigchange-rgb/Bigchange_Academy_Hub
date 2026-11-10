/**
 * Original, in-memory academic planning model.
 * NO authentication, persistence or secure audit. Fictional records only.
 */
import { DEMO_COURSES, DEMO_SLOTS } from './operations.mjs';

export const INITIAL_DEMO_TERMS = [
  {id:'term-autumn-2026',label:'Oct–Dec 2026 · Sample term',start:'2026-10-01',end:'2026-12-31'},
  {id:'term-spring-2027',label:'Jan–Mar 2027 · Sample term',start:'2027-01-04',end:'2027-03-31'}
];

export const DEMO_SYLLABUS = Object.freeze({
  computer: ['Computer parts & care','Files and folders','Internet basics','Digital safety','Hardware mini project'],
  creative: ['Layout and colors','Canva poster','Working with photos','Design critique','Portfolio project'],
  ai: ['What is AI?','Responsible prompting','Comparing answers','AI safety','Class presentation'],
  automation: ['Spreadsheet inputs','Simple webhooks','Automation testing','AI helpers','Mini workflow project'],
  scratch: ['Sprites and movement','Events and loops','Sounds and scenes','Debugging','Game challenge']
});

export const INITIAL_DEMO_SESSIONS = [
  {id:'session-1',classId:'class-1',termId:'term-autumn-2026',date:'2026-10-19',topic:'Computer parts & care',objective:'Identify the CPU, RAM and storage in a diagram.'},
  {id:'session-2',classId:'class-1',termId:'term-autumn-2026',date:'2026-10-21',topic:'Files and folders',objective:'Organize three sample school files into folders.'},
  {id:'session-3',classId:'class-2',termId:'term-autumn-2026',date:'2026-10-20',topic:'Canva poster',objective:'Create a clear fictional event poster.'},
  {id:'session-4',classId:'class-3',termId:'term-autumn-2026',date:'2026-10-17',topic:'Responsible prompting',objective:'Explain how to check an AI-generated answer.'},
  {id:'session-5',classId:'class-4',termId:'term-autumn-2026',date:'2026-10-19',topic:'Sprites and movement',objective:'Move a sample sprite across a stage.'}
];
export const INITIAL_DEMO_ATTENDANCE = [
  {sessionId:'session-1',learnerId:'learner-a',status:'Present'},
  {sessionId:'session-1',learnerId:'learner-b',status:'Absent'},
  {sessionId:'session-1',learnerId:'learner-c',status:'Late'}
];
export const INITIAL_DEMO_ACADEMICS = {
  terms:INITIAL_DEMO_TERMS,
  sessions:INITIAL_DEMO_SESSIONS,
  attendance:INITIAL_DEMO_ATTENDANCE,
  history:[]
};
export const ATTENDANCE_STATUSES = Object.freeze(['Present','Absent','Late','Excused']);

function isoDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const d=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
}
function validLesson(topic,objective){
  if(typeof topic!=='string'||typeof objective!=='string'||topic.trim().length<3||topic.trim().length>100
      ||objective.trim().length<8||objective.trim().length>400)
    throw Error('Topic must be 3–100 characters; learning goal must be 8–400 characters');
}
function classById(classes,classId){
  const classroom=classes.find(c=>c.id===classId);
  if(!classroom)throw Error('Unknown fictional class group');
  return classroom;
}
function termById(terms,termId){
  const term=terms.find(t=>t.id===termId);
  if(!term)throw Error('Unknown academic term');
  return term;
}
function assertTermDate(term,date){
  const d=isoDate(date);
  if(!d||date<term.start||date>term.end)throw Error('Select a real date within this term');
  return d;
}
function slotDays(slot){
  if(!DEMO_SLOTS.includes(slot))throw Error('Unrecognized class timetable');
  const days=slot.split(' · ')[0].split(' + ');
  const code={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return days.map(day=>code[day]);
}
/** @param {Array<{id:string,label:string,start:string,end:string}>} terms */
export function createDemoTerm(terms,{label,start,end}){
  const first=isoDate(start),last=isoDate(end);
  if(typeof label!=='string'||label.trim().length<5||label.trim().length>80)throw Error('Term name must be 5–80 characters');
  if(!first||!last||last<first)throw Error('Enter valid beginning and ending dates');
  const length=(last-first)/86400000+1;
  if(length<28||length>125)throw Error('A sample term must last between 28 and 125 days');
  if(terms.some(t=>start<=t.end&&end>=t.start))throw Error('Term dates overlap an existing sample term');
  const used=new Set(terms.map(t=>t.id));
  let n=1;while(used.has('term-'+n))n++;
  return [...terms,{id:'term-'+n,label:label.trim(),start,end}].sort((a,b)=>a.start.localeCompare(b.start));
}
/** @param {Array} classes @param {Array} terms @param {Array} sessions */
export function createDemoSession(classes,terms,sessions,{classId,termId,date,topic,objective,moduleName}){
  const classroom=classById(classes,classId), term=termById(terms,termId);
  const d=assertTermDate(term,date);
  if(!slotDays(classroom.slot).includes(d.getUTCDay()))throw Error('Date does not match this class’s two weekly meeting days');
  validLesson(topic,objective);
  if(sessions.some(s=>s.classId===classId&&s.date===date))throw Error('That class already has a lesson on this date');
  if(sessions.filter(s=>s.classId===classId&&s.termId===termId).length>=30)throw Error('Sample term limit: 30 class sessions');
  const used=new Set(sessions.map(s=>s.id));
  let n=1;while(used.has('session-'+n))n++;
  return [...sessions,{id:'session-'+n,classId,termId,date,topic:topic.trim(),objective:objective.trim(),moduleName:typeof moduleName==='string'?moduleName.trim():'',status:/** @type {'planned'|'completed'} */ ('planned')}]
    .sort((a,b)=>a.date.localeCompare(b.date)||a.classId.localeCompare(b.classId));
}
export function reviseDemoSession(sessions,sessionId,{topic,objective}){
  if(!sessions.some(s=>s.id===sessionId))throw Error('Select a planned lesson');
  validLesson(topic,objective);
  return sessions.map(s=>s.id===sessionId?{...s,topic:topic.trim(),objective:objective.trim()}:s);
}

/**
 * Update a lesson while preserving its stable session ID. Attendance remains linked
 * to this ID; rescheduling never silently drops marks. Fictional browser state only.
 */
export function updateDemoSession(sessions,sessionId,{topic,objective,date},{classes,terms}){
  const previous=sessions.find(s=>s.id===sessionId);
  if(!previous)throw Error('Select a planned lesson');
  validLesson(topic,objective);
  const classroom=classById(classes,previous.classId);
  const term=termById(terms,previous.termId);
  const d=assertTermDate(term,date);
  if(!slotDays(classroom.slot).includes(d.getUTCDay()))
    throw Error('Choose one of this class’s two weekly meeting days');
  if(sessions.some(s=>s.id!==sessionId&&s.classId===previous.classId&&s.date===date))
    throw Error('This class already has a lesson on that date');
  return sessions.map(s=>s.id===sessionId
    ?{...s,date,topic:topic.trim(),objective:objective.trim()}
    :s).sort((a,b)=>a.date.localeCompare(b.date)||a.classId.localeCompare(b.classId));
}
/** Each session's marks are independently keyed to the class, date, and learner.
 * The change log is only an in-browser demonstration, NOT an immutable server audit.
 * @param {{attendance:Array,history:Array}} current
 */
export function markDemoSessionAttendance(current,{classes,sessions,sessionId,learnerId,status}){
  const session=sessions.find(s=>s.id===sessionId);
  if(!session)throw Error('Unknown sample lesson');
  const classroom=classById(classes,session.classId);
  if(!classroom.learnerIds.includes(learnerId))throw Error('Learner is not enrolled in this class');
  if(!ATTENDANCE_STATUSES.includes(status))throw Error('Select a valid attendance status');
  const old=current.attendance.find(x=>x.sessionId===sessionId&&x.learnerId===learnerId);
  if(old?.status===status)throw Error('Attendance is already marked with that status');
  const attendance=[
    ...current.attendance.filter(x=>!(x.sessionId===sessionId&&x.learnerId===learnerId)),
    {sessionId,learnerId,status}
  ];
  const history=[...current.history,{
    sequence:current.history.length+1,
    sessionId,learnerId,before:old?.status??'Unmarked',after:status
  }];
  return {...current,attendance,history};
}
export function sessionSummary(attendance,sessionId,rosterIds){
  const marks=rosterIds.map(id=>attendance.find(x=>x.sessionId===sessionId&&x.learnerId===id)?.status??'Unmarked');
  return {
    total:rosterIds.length,
    present:marks.filter(x=>x==='Present').length,
    absent:marks.filter(x=>x==='Absent').length,
    late:marks.filter(x=>x==='Late').length,
    excused:marks.filter(x=>x==='Excused').length,
    unmarked:marks.filter(x=>x==='Unmarked').length
  };
}
export function availableSyllabus(courseId,courses=DEMO_COURSES){
  const course=courses.find(c=>c.id===courseId);
  if(!course)throw Error('Invalid course');
  return Array.isArray(course.syllabus)?course.syllabus:(DEMO_SYLLABUS[courseId]??[]);
}


/**
 * Change delivery status without changing the session ID or attendance references.
 * @template {{id:string}} T
 * @param {T[]} sessions
 * @param {string} sessionId
 * @param {'planned'|'completed'} status
 * @returns {T[]}
 */
export function setDemoSessionStatus(sessions,sessionId,status){
  if(!['planned','completed'].includes(status))throw Error('Choose a valid lesson status');
  if(!sessions.some(s=>s.id===sessionId))throw Error('Select a planned lesson');
  return sessions.map(s=>s.id===sessionId?{...s,status}:s);
}

/**
 * Summarize the selected class/term against the current course syllabus, in syllabus order.
 * Older sample sessions are matched by topic; new sessions keep a separate module label when titles change.
 * @param {Array<{id:string,classId:string,termId:string,topic:string,moduleName?:string,status?:'planned'|'completed'}>} sessions
 * @param {{classId:string,termId:string,syllabus:string[]}} options
 */
export function curriculumProgress(sessions,{classId,termId,syllabus}){
  if(!Array.isArray(syllabus))return [];
  return syllabus.map((module,index)=>{
    const matching=sessions.filter(s=>s.classId===classId&&s.termId===termId&&(s.moduleName||s.topic)===module);
    const completed=matching.filter(s=>s.status==='completed').length;
    const total=matching.length;
    const status=total===0?'Not planned':completed===0?'Planned':completed===total?'Complete':'In progress';
    return {module,order:index+1,total,completed,status};
  });
}
