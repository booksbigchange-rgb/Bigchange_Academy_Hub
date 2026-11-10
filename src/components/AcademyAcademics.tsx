import { useState, type FormEvent } from 'react';
import { visibleDemoClasses } from '../lib/operations.mjs';
import type {CourseRecord} from './AcademyCourseCatalog';
import {
  ATTENDANCE_STATUSES, availableSyllabus, createDemoSession, curriculumProgress, setDemoSessionStatus,
  createDemoTerm, markDemoSessionAttendance, reviseDemoSession, updateDemoSession, sessionSummary
} from '../lib/academics.mjs';
import type { ClassRoom, Person } from './AcademyOperations';

type Role = 'Student'|'Teacher'|'Administrator';
export type Term = {id:string;label:string;start:string;end:string};
export type Lesson = {id:string;classId:string;termId:string;date:string;topic:string;objective:string;moduleName?:string;status?:'planned'|'completed'};
export type AttendanceRecord = {sessionId:string;learnerId:string;status:string};
export type AttendanceChange = {sequence:number;sessionId:string;learnerId:string;before:string;after:string};
export type AcademicState = {terms:Term[];sessions:Lesson[];attendance:AttendanceRecord[];history:AttendanceChange[]};
type Props = {view:'Lessons'|'Attendance';role:Role;classes:ClassRoom[];courses:CourseRecord[];learners:Person[];teacherId?:string;learnerId?:string;academic:AcademicState;onUpdate:(next:AcademicState)=>void};
function formatDate(iso:string){
  return new Date(iso+'T12:00:00.000Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
}
function LessonEditor({lesson,canEdit,term,onSave}:{lesson:Lesson;canEdit:boolean;term:Term;onSave:(topic:string,objective:string,date:string)=>void}){
  const [topic,setTopic]=useState(lesson.topic);
  const [objective,setObjective]=useState(lesson.objective);
  const [date,setDate]=useState(lesson.date);
  return <form className="academic-edit" onSubmit={e=>{e.preventDefault();onSave(topic,objective,date);}}>
    <label>Lesson date<input type="date" value={date} min={term.start} max={term.end} onChange={e=>setDate(e.target.value)} required disabled={!canEdit}/></label>
    <label>Lesson title<input value={topic} onChange={e=>setTopic(e.target.value)} minLength={3} maxLength={100} required disabled={!canEdit}/></label>
    <label>Learning objective<textarea value={objective} onChange={e=>setObjective(e.target.value)} minLength={8} maxLength={400} rows={3} required disabled={!canEdit}/></label>
    <p className="quiet">The date must match this class’s weekly schedule. Attendance stays attached to this lesson when it moves.</p>
    {canEdit&&<button type="submit" className="small-btn">Save lesson changes</button>}
  </form>;
}
export default function AcademyAcademics({view,role,classes,courses,learners,academic,onUpdate,teacherId='teacher-a',learnerId='learner-a'}:Props){
  const courseName=(id:string)=>courses.find(x=>x.id===id)?.name??'Sample subject';
  const learnerName=(id:string)=>learners.find(x=>x.id===id)?.name??'Fictional learner';
  const visible=visibleDemoClasses(classes,role,{teacherId,learnerId});
  const [classChoice,setClassChoice]=useState('');
  const [termChoice,setTermChoice]=useState('term-autumn-2026');
  const [lessonChoice,setLessonChoice]=useState('');
  const [date,setDate]=useState('2026-10-26');
  const [topic,setTopic]=useState('Computer parts & care');
  const [objective,setObjective]=useState('Identify computer components and describe one safe handling rule.');
  const [termLabel,setTermLabel]=useState('Apr–Jun 2027 · Sample term');
  const [start,setStart]=useState('2027-04-01');
  const [end,setEnd]=useState('2027-06-30');
  const [feedback,setFeedback]=useState('');
  const [showHistory,setShowHistory]=useState(false);
  const currentClass=visible.find(c=>c.id===classChoice)??visible[0];
  const currentTerm=academic.terms.find(t=>t.id===termChoice)??academic.terms[0];
  const lessons=academic.sessions.filter(s=>s.classId===currentClass?.id&&s.termId===currentTerm?.id)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const selected=lessons.find(s=>s.id===lessonChoice)??lessons[0];
  const selectedStatus=selected?.status==='completed'?'completed':'planned';
  const editable=role==='Administrator'||role==='Teacher';
  const syllabus: string[]=currentClass?availableSyllabus(currentClass.courseId,courses):[];
  const moduleProgress=currentClass&&currentTerm?curriculumProgress(academic.sessions,{classId:currentClass.id,termId:currentTerm.id,syllabus}):[];
  const completedModules=moduleProgress.filter(item=>item.status==='Complete').length;
  const progressPercent=moduleProgress.length?Math.round(completedModules/moduleProgress.length*100):0;
  const summary=selected&&currentClass?sessionSummary(academic.attendance,selected.id,currentClass.learnerIds):null;
  const currentHistory=academic.history.filter(h=>h.sessionId===selected?.id).slice(-10).reverse();
  function change(action:()=>AcademicState,success:string){
    try{onUpdate(action());setFeedback(success);}catch(error){setFeedback(error instanceof Error?error.message:'Could not update sample data');}
  }
  function addTerm(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    change(()=>({...academic,terms:createDemoTerm(academic.terms,{label:termLabel,start,end})}),'Fictional term created; refresh to reset.');
  }
  function addLesson(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    change(()=>({...academic,sessions:createDemoSession(classes,academic.terms,academic.sessions,{
      classId:currentClass?.id??'',termId:currentTerm?.id??'',date,topic,objective,moduleName:syllabus.includes(topic)?topic:''
    })}),'Lesson planned for this sample class. Nothing was stored.');
  }
  const editingLesson=selected&&currentTerm&&<LessonEditor key={selected.id} lesson={selected} canEdit={editable} term={currentTerm}
    onSave={(title,goal,newDate)=>change(()=>({...academic,sessions:updateDemoSession(academic.sessions,selected.id,
      {topic:title,objective:goal,date:newDate},{classes,terms:academic.terms})}),
      'Lesson updated. Attendance remains linked to the same session.')}/>;
  return <div className="academic">
    <section className="panel">
      <span className="eyebrow">CLASSROOM LEARNING · FICTIONAL RECORDS</span>
      <h2>{view==='Lessons'?'Lesson planner and terms':'Attendance by lesson session'}</h2>
      <p>Two sample sessions per week. Every lesson and mark belongs to a specific classroom and date.</p>
      <div className="academic-controls">
        <label>Class group<select value={currentClass?.id??''} onChange={e=>{setClassChoice(e.target.value);setLessonChoice('');setFeedback('');}}>
          {visible.length===0&&<option value="">No assigned classes</option>}
          {visible.map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}
        </select></label>
        <label>Academic term<select value={currentTerm?.id??''} onChange={e=>{setTermChoice(e.target.value);setLessonChoice('');setFeedback('');}}>
          {academic.terms.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
        {currentTerm&&<div className="academic-term-dates"><b>Term dates</b><span>{formatDate(currentTerm.start)} – {formatDate(currentTerm.end)}</span></div>}
      </div>
      {!visible.length?<p className="quiet">No sample class is assigned to this preview role.</p>:<>
        <h3>{role==='Student'?'My planned lessons':'Session list'} <span className="academic-count">{lessons.length} planned</span></h3>
        <div className="academic-sessions">
          {lessons.map(s=><button key={s.id} className={'academic-session '+(s.id===selected?.id?'selected':'')}
            type="button" aria-pressed={s.id===selected?.id} onClick={()=>{setLessonChoice(s.id);setFeedback('');}}>
            <strong>{formatDate(s.date)}</strong><span>{s.topic}</span><span className={'academic-session-status '+(s.status==='completed'?'is-complete':'is-planned')}>{s.status==='completed'?'Completed':'Planned'}</span>
          </button>)}
          {!lessons.length&&<p className="quiet">No sessions are planned for this class in this term yet.</p>}
        </div>
      </>}
    </section>
    {selected&&currentClass&&<section className="panel">
      <span className="eyebrow">{view==='Lessons'?'LESSON CONTENT':'INDIVIDUAL SESSION REGISTER'} · {formatDate(selected.date)}</span>
      <h2>{view==='Lessons'?'Learning objective': 'Mark fictional attendance'}</h2>
      {view==='Lessons'?<>
        <p>The lesson plan is specific to {courseName(currentClass.courseId)} in {currentClass.id.toUpperCase()}.</p>
        {editingLesson}
        {view==='Lessons'&&<div className="lesson-delivery">
          <div><span className={'lesson-status-tag '+(selectedStatus==='completed'?'is-complete':'is-planned')}>{selectedStatus==='completed'?'Completed':'Planned'}</span>
            <p>{selectedStatus==='completed'?'This lesson is marked complete in the current browser session.':'Mark this lesson complete after teaching and reviewing the planned activity.'}</p></div>
          {editable&&<button type="button" className="small-btn" onClick={()=>change(()=>({...academic,sessions:setDemoSessionStatus(academic.sessions,selected.id,selectedStatus==='completed'?'planned':'completed')}),selectedStatus==='completed'?'Lesson reopened as planned.':'Lesson marked completed. Progress updated.')}>{selectedStatus==='completed'?'Reopen lesson':'Mark lesson completed'}</button>}
        </div>}
        <p className="quiet">Teacher previews may edit only the selected instructor’s groups. This is not server authorization.</p>
      </>:<>
        <div className="academic-summary">
          {([{name:'Present',count:summary?.present},{name:'Absent',count:summary?.absent},{name:'Late',count:summary?.late},{name:'Unmarked',count:summary?.unmarked}]).map(x=>
            <div key={x.name}><strong>{x.count??0}</strong><small>{x.name}</small></div>)}
        </div>
        {(role==='Student'?currentClass.learnerIds.filter(id=>id===learnerId):currentClass.learnerIds).map(id=>{
          const status=academic.attendance.find(a=>a.sessionId===selected.id&&a.learnerId===id)?.status??'Unmarked';
          return <div className="roster-row" key={id}>
            <span className="student-token">{id.slice(-1).toUpperCase()}</span><strong>{learnerName(id)}</strong>
            {editable?<label className="attendance-picker">Status <select value={status} aria-label={'Attendance for '+learnerName(id)+' on '+selected.date}
              onChange={e=>change(()=>({...academic,...markDemoSessionAttendance(academic,{
                classes,sessions:academic.sessions,sessionId:selected.id,learnerId:id,status:e.target.value
              })}),'Updated '+learnerName(id)+' for '+formatDate(selected.date)+' (demo only).')}>
              <option value="Unmarked" disabled>Unmarked</option>
              {ATTENDANCE_STATUSES.map(option=><option key={option}>{option}</option>)}
            </select></label>:<span className="tag">{status}</span>}
          </div>;
        })}
        {currentClass.learnerIds.length===0&&<p className="quiet">No fictional learners are enrolled in this group.</p>}
        {editable&&<div className="academic-history">
          <button type="button" className="text-btn" aria-expanded={showHistory} onClick={()=>setShowHistory(!showHistory)}>
            {showHistory?'Hide':'Show'} browser-only correction history ({currentHistory.length} recent)
          </button>
          {showHistory&&<ol>
            {currentHistory.map(h=><li key={h.sequence}>{learnerName(h.learnerId)}: {h.before} → {h.after}</li>)}
            {!currentHistory.length&&<li>No changes recorded in this browser tab.</li>}
          </ol>}
        </div>}
        <p className="quiet">Excused marks also count as recorded. Unmarked means no attendance decision has been entered.</p>
      </>}
    </section>}
    {view==='Lessons'&&currentClass&&currentTerm&&<section className="panel curriculum-progress-panel">
      <div className="panel-head"><div><span className="eyebrow">COURSE SEQUENCE · FICTIONAL PROGRESS</span><h2>Module progress</h2>
        <p>Progress is calculated for this class and term from planned lesson sessions.</p></div>
        <strong className="curriculum-progress-summary">{completedModules} of {moduleProgress.length} modules complete</strong>
      </div>
      <div className="curriculum-progress-track" role="progressbar" aria-label="Course module completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <span className="curriculum-progress-fill" style={{width:`${progressPercent}%`}}/>
      </div>
      <ol className="curriculum-module-list">
        {moduleProgress.map(item=><li key={item.module}>
          <span className="curriculum-module-number">{item.order}</span>
          <div className="curriculum-module-copy"><strong>{item.module}</strong><small>{item.total?item.completed+' of '+item.total+' lesson sessions completed':'No lesson planned yet'}</small></div>
          <span className={'curriculum-module-status '+item.status.toLowerCase().replace(/ /g,'-')}>{item.status}</span>
        </li>)}
      </ol>
    </section>}
    {view==='Lessons'&&editable&&currentClass&&currentTerm&&<div className="operations-grid">
      <section className="panel">
        <span className="eyebrow">TWO DAYS PER WEEK · TERM VALIDATION</span><h2>Add a planned lesson</h2>
        <p>Choose a class meeting day within the selected term.</p>
        <form className="ops-form" onSubmit={addLesson}>
          <label>Session date<input type="date" required min={currentTerm.start} max={currentTerm.end} value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>Course module<select value={syllabus.includes(topic)?topic:''} onChange={e=>setTopic(e.target.value)}>
            <option value="">Custom topic</option>{syllabus.map(x=><option key={x} value={x}>{x}</option>)}
          </select></label>
          <label className="academic-wide">Lesson topic<input value={topic} minLength={3} maxLength={100} required onChange={e=>setTopic(e.target.value)}/></label>
          <label className="academic-wide">Learning goal<textarea value={objective} required minLength={8} maxLength={400} rows={3} onChange={e=>setObjective(e.target.value)}/></label>
          <button type="submit" className="primary-btn">Add fictional lesson</button>
        </form>
      </section>
      {role==='Administrator'&&<section className="panel">
        <span className="eyebrow">ADMIN · FICTIONAL TERM SETUP</span><h2>Create academic term</h2>
        <p>Terms cannot overlap and must last 28–125 days.</p>
        <form className="ops-form" onSubmit={addTerm}>
          <label className="academic-wide">Term name<input value={termLabel} minLength={5} maxLength={80} required onChange={e=>setTermLabel(e.target.value)}/></label>
          <label>Start<input type="date" value={start} required onChange={e=>setStart(e.target.value)}/></label>
          <label>End<input type="date" value={end} required onChange={e=>setEnd(e.target.value)}/></label>
          <button type="submit" className="primary-btn">Add fictional term</button>
        </form>
      </section>}
    </div>}
    <p className="ops-feedback" role="status" aria-live="polite">{feedback}</p>
    <p className="quiet">Privacy: fictional people only. This is temporary client-side state, not a real school register, verified gradebook, or immutable audit record. Refresh to reset.</p>
  </div>;
}
