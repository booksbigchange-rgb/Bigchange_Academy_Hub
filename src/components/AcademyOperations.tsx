import { useMemo, useState, type FormEvent } from 'react';
import {
  DEMO_COURSES, DEMO_TEACHERS, DEMO_LEARNERS, DEMO_SLOTS,
  createDemoClass, enrollDemoLearner, removeDemoLearner, assignDemoTeacher,
  visibleDemoClasses, enrolledClassCount
} from '../lib/operations.mjs';

export type ClassRoom = {
  id: string; courseId: string; teacherId: string; slot: string; capacity: number; learnerIds: string[];
};
type Role = 'Student' | 'Teacher' | 'Administrator';
type View = 'Classes' | 'Directory' | 'Timetable';
type Props = { view: View; role: Role; classes: ClassRoom[]; onUpdate: (next: ClassRoom[]) => void };
const courseName = (id:string) => DEMO_COURSES.find(c=>c.id===id)?.name ?? 'Unknown course';
const teacherName = (id:string) => DEMO_TEACHERS.find(t=>t.id===id)?.name ?? 'Unknown instructor';
const learnerName = (id:string) => DEMO_LEARNERS.find(l=>l.id===id)?.name ?? 'Unknown learner';

export default function AcademyOperations({view,role,classes,onUpdate}:Props){
  const visible=useMemo(()=>visibleDemoClasses(classes,role),[classes,role]);
  const [courseId,setCourseId]=useState('computer');
  const [teacherId,setTeacherId]=useState('teacher-a');
  const [slot,setSlot]=useState('Tue + Thu · 16:00');
  const [capacity,setCapacity]=useState(10);
  const [chosenClass,setChosenClass]=useState('');
  const [chosenLearner,setChosenLearner]=useState('learner-a');
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState('all');
  const [manageClass,setManageClass]=useState('');
  const canManage=role==='Administrator';
  const displayed=visible.filter(c=>filter==='all'||c.courseId===filter);
  function handle(operation:()=>ClassRoom[],success:string){
    try{onUpdate(operation());setMessage(success);}
    catch(error){setMessage(error instanceof Error?error.message:'Cannot update sample data');}
  }
  function addClass(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    handle(()=>createDemoClass(classes,{courseId,teacherId,slot,capacity}),'Fictional class added. Nothing was stored.');
  }
  function enroll(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const classroom=classes.find(c=>c.id===chosenClass);
    handle(()=>enrollDemoLearner(classes,chosenClass,chosenLearner),
      'Enrolled '+learnerName(chosenLearner)+' in '+courseName(classroom?.courseId??'')+' (demo only).');
  }
  if(view==='Directory')return <section className="panel operations">
    <span className="eyebrow">FICTIONAL PEOPLE · NO PERSONAL RECORDS</span>
    <h2>{role==='Administrator'?'Teacher and learner directory':'My class rosters'}</h2>
    <p>{role==='Administrator'?'Browse sample instructors and fictional learner enrollments.':'Only classes assigned to Instructor A appear in this preview.'}</p>
    {canManage&&<div className="people-grid">
      {DEMO_TEACHERS.map(teacher=><div className="person-tile" key={teacher.id}>
        <span className="student-token" aria-hidden="true">✳</span><div><strong>{teacher.name}</strong><small>{classes.filter(c=>c.teacherId===teacher.id).length} sample groups</small></div>
      </div>)}
    </div>}
    <div className="table-wrap"><table><thead><tr><th>Fictional learner</th><th>Enrolled groups</th><th>Subjects</th></tr></thead><tbody>
      {DEMO_LEARNERS.filter(learner=>visible.some(c=>c.learnerIds.includes(learner.id))).map(learner=>{
        const roster=visible.filter(c=>c.learnerIds.includes(learner.id));
        return <tr key={learner.id}><td>{learner.name}</td><td>{roster.length}</td><td>{roster.map(c=>courseName(c.courseId)).join(', ')}</td></tr>;
      })}
    </tbody></table></div>
    <p className="quiet">This directory does not reveal actual contact details, school records or accounts.</p>
  </section>;
  if(view==='Timetable')return <section className="panel operations">
    <span className="eyebrow">TWO SESSIONS PER WEEK · SAMPLE SCHEDULE</span>
    <h2>{role==='Teacher'?'My teaching timetable':role==='Student'?'My sample timetable':'Academy timetable'}</h2>
    <p>Scheduled groups are derived from the class roster. These are illustration times, not confirmed lessons.</p>
    <div className="schedule-grid">
      {DEMO_SLOTS.map(time=>{
        const scheduled=visible.filter(c=>c.slot===time);
        return <div className="schedule-tile" key={time}>
          <strong>{time}</strong>
          {scheduled.length ? scheduled.map(c=><div className="schedule-entry" key={c.id}>
            <b>{courseName(c.courseId)}</b><small>{teacherName(c.teacherId)} · {c.learnerIds.length}/{c.capacity} learners</small>
          </div>):<p className="quiet">No sample class in this slot</p>}
        </div>;
      })}
    </div>
  </section>;
  return <div className="operations">
    <div className="metric-grid ops-metrics">
      <div className="metric"><span className="metric-icon">▣</span><div className="metric-value">{visible.length}</div><div className="metric-title">{role==='Administrator'?'Total groups':role==='Teacher'?'Assigned groups':'My groups'}</div><div className="metric-subtitle">Fictional active class groups</div></div>
      <div className="metric"><span className="metric-icon">♧</span><div className="metric-value">{visible.reduce((sum,c)=>sum+c.learnerIds.length,0)}</div><div className="metric-title">Enrollments</div><div className="metric-subtitle">Course seats, not unique people</div></div>
      <div className="metric"><span className="metric-icon">✳</span><div className="metric-value">{new Set(visible.map(c=>c.teacherId)).size}</div><div className="metric-title">Instructors</div><div className="metric-subtitle">Assigned to visible sample groups</div></div>
    </div>
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">CLASS MANAGEMENT · SAMPLE ONLY</span>
        <h2>{role==='Teacher'?'Assigned teaching groups':role==='Student'?'My learning groups':'Manage classes and enrollment'}</h2>
      </div><label className="ops-filter">Course
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All courses</option>{DEMO_COURSES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label></div>
      <div className="table-wrap"><table><thead><tr><th>Group</th><th>Course</th><th>Instructor</th><th>Schedule</th><th>Capacity</th><th>Roster</th></tr></thead><tbody>
        {displayed.map(c=><tr key={c.id}>
          <td>{c.id.toUpperCase()}</td><td>{courseName(c.courseId)}</td>
          <td>{canManage?<select className="ops-inline-select" aria-label={'Assign instructor for '+c.id} value={c.teacherId}
              onChange={e=>handle(()=>assignDemoTeacher(classes,c.id,e.target.value),'Sample teacher assignment changed.')}>
            {DEMO_TEACHERS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>:teacherName(c.teacherId)}</td>
          <td>{c.slot}</td><td><span className={'tag '+(c.learnerIds.length===c.capacity?'amber':'green')}>{c.learnerIds.length}/{c.capacity}</span></td>
          <td><button className="text-btn" aria-expanded={manageClass===c.id} onClick={()=>setManageClass(manageClass===c.id?'':c.id)}>Roster {manageClass===c.id?'↑':'↓'}</button></td>
        </tr>)}
      </tbody></table></div>
      {displayed.length===0&&<p className="quiet">No fictional groups match this filter.</p>}
      {visible.filter(c=>manageClass===c.id).map(c=><div className="roster-detail" key={c.id}>
        <h3>{courseName(c.courseId)} · {c.id.toUpperCase()} roster</h3>
        <div className="roster-chips">
          {(role==='Student' ? c.learnerIds.filter(id=>id==='learner-a') : c.learnerIds).map(id=><span className="roster-chip" key={id}>{learnerName(id)}
            {canManage&&<button aria-label={'Remove '+learnerName(id)+' from '+c.id} title="Remove fictional enrollment"
               onClick={()=>handle(()=>removeDemoLearner(classes,c.id,id),'Removed a fictional enrollment.')} type="button">×</button>}
          </span>)}
          {c.learnerIds.length===0&&<p>No sample learners enrolled yet.</p>}
        </div>
      </div>)}
      <p className="quiet">Role switcher is a visual preview only. These controls do not grant backend permissions.</p>
    </section>
    {canManage&&<div className="operations-grid">
      <section className="panel"><span className="eyebrow">ADMINISTRATION · FICTIONAL DATA</span><h2>Create a sample class</h2>
        <form className="ops-form" onSubmit={addClass}>
          <label>Course<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{DEMO_COURSES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Assigned instructor<select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>{DEMO_TEACHERS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Two weekly sessions<select value={slot} onChange={e=>setSlot(e.target.value)}>{DEMO_SLOTS.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label>Seat limit<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[5,10,15,20].map(x=><option key={x} value={x}>{x} seats</option>)}</select></label>
          <button type="submit" className="primary-btn">Create fictional group</button>
        </form>
      </section>
      <section className="panel"><span className="eyebrow">ADMINISTRATION · FICTIONAL DATA</span><h2>Enroll a sample learner</h2>
        <form className="ops-form" onSubmit={enroll}>
          <label>Class group<select required value={chosenClass} onChange={e=>setChosenClass(e.target.value)}><option value="">Choose a group</option>{classes.map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}</select></label>
          <label>Fictional learner<select value={chosenLearner} onChange={e=>setChosenLearner(e.target.value)}>{DEMO_LEARNERS.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <button type="submit" className="primary-btn">Enroll in sample class</button>
        </form>
        <p className="quiet">Enrollment rejects duplicate course groups and full classes. Refreshing resets the preview.</p>
      </section>
    </div>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
    {role==='Student'&&<p className="quiet">Learner A attends {enrolledClassCount(classes,'learner-a')} illustrative class groups.</p>}
  </div>;
}
