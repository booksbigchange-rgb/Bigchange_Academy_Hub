import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import {
  DEMO_COURSES, DEMO_SLOTS, addDemoTeacher, addDemoLearner,renameDemoPerson,setDemoPersonActive,activeDemoPeople,
  createDemoClass, enrollDemoLearner, enrollDemoLearnerForRole, removeDemoLearner, assignDemoTeacher,updateDemoClass,transferDemoLearner,
  visibleDemoClasses, enrolledClassCount
} from '../lib/operations.mjs';

export type ClassRoom = {
  id: string; courseId: string; teacherId: string; slot: string; capacity: number; learnerIds: string[];
};
export type Person = {id:string;name:string;active?:boolean};
type Role = 'Student' | 'Teacher' | 'Administrator';
type View = 'Classes' | 'Directory' | 'Timetable';
type Props = { view: View; role: Role; classes: ClassRoom[]; onUpdate: (next: ClassRoom[]) => void;
  teachers: Person[]; learners: Person[]; guardians?:{id:string;learnerIds:string[]}[]; teacherId?:string;learnerId?:string; sessions?:{classId:string;date:string}[]; focusPerson?:'teacher'|'student'|null;
  onTeachers:(list:Person[])=>void; onLearners:(list:Person[])=>void };
const courseName = (id:string) => DEMO_COURSES.find(c=>c.id===id)?.name ?? 'Unknown course';

export default function AcademyOperations({view,role,classes,onUpdate,teachers,learners,guardians=[],teacherId='teacher-a',learnerId='learner-a',sessions=[],focusPerson,onTeachers,onLearners}:Props){
  const teacherInput=useRef<HTMLInputElement>(null);
  const studentInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(view!=='Directory'||role!=='Administrator')return;
    if(focusPerson==='teacher')teacherInput.current?.focus();
    if(focusPerson==='student')studentInput.current?.focus();
  },[view,role,focusPerson]);
  const teacherName=(id:string)=>teachers.find(t=>t.id===id)?.name??'Sample instructor';
  const learnerName=(id:string)=>learners.find(l=>l.id===id)?.name??'Sample learner';
  const visible=useMemo(()=>visibleDemoClasses(classes,role,{teacherId,learnerId}),[classes,role,teacherId,learnerId]);
  const activeTeachers=activeDemoPeople(teachers) as Person[];
  const activeLearners=activeDemoPeople(learners) as Person[];
  const [courseId,setCourseId]=useState('computer');
  const [assignedTeacherId,setAssignedTeacherId]=useState('teacher-a');
  const [slot,setSlot]=useState('Tue + Thu · 16:00');
  const [capacity,setCapacity]=useState(10);
  const [chosenClass,setChosenClass]=useState('');
  const [chosenLearner,setChosenLearner]=useState('learner-a');
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState('all');
  const [manageClass,setManageClass]=useState('');
  const [editClassId,setEditClassId]=useState('');
  const [editTeacher,setEditTeacher]=useState('teacher-a');
  const [editSlot,setEditSlot]=useState(DEMO_SLOTS[0]);
  const [editCapacity,setEditCapacity]=useState(10);
  const [transferFrom,setTransferFrom]=useState('');
  const [transferTo,setTransferTo]=useState('');
  const [transferLearner,setTransferLearner]=useState('');
  const [studentSearch,setStudentSearch]=useState('');
  const [studentStatus,setStudentStatus]=useState<'all'|'active'|'inactive'|'unenrolled'>('all');
  const [teacherDraft,setTeacherDraft]=useState('Sample Teacher Delta');
  const [learnerDraft,setLearnerDraft]=useState('Sample Learner Indigo');
  const [directoryClass,setDirectoryClass]=useState('');
  const [directoryLearner,setDirectoryLearner]=useState('learner-a');
  const [editRole,setEditRole]=useState<'teacher'|'learner'>('teacher');
  const [editId,setEditId]=useState('');
  const [editName,setEditName]=useState('');
  const [pendingDeactivate,setPendingDeactivate]=useState(false);
  const canManage=role==='Administrator';
  const displayed=visible.filter(c=>filter==='all'||c.courseId===filter);
  const directoryGroups=role==='Teacher'?visible:classes;
  const editing=editRole==='teacher'?teachers:learners;
  const editableEntries=editing.filter(p=>p.id.startsWith(editRole+'-demo-'));
  const editRecord=editableEntries.find(p=>p.id===editId);
  function createTeacher(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{onTeachers(addDemoTeacher(teachers,teacherDraft));setMessage('Added fictional teacher. Assign them to a class in Classes.');}
    catch(error){setMessage(error instanceof Error?error.message:'Cannot add a sample teacher');}
  }
  function createLearner(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{onLearners(addDemoLearner(learners,learnerDraft));setMessage('Added fictional student. Enroll them in a class using the form below.');}
    catch(error){setMessage(error instanceof Error?error.message:'Cannot add a sample student');}
  }
  function updatePerson(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      if(!canManage||!editRecord)throw Error('Choose an added fictional person');
      const changed=renameDemoPerson(editing,editRecord.id,editName,editRole);
      if(editRole==='teacher')onTeachers(changed);else onLearners(changed);
      setMessage('Sample name updated. Their class and grade links are unchanged.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not edit the sample person');}
  }
  function togglePerson(){
    try{
      if(!canManage||!editRecord)throw Error('Choose an added fictional person');
      const activate=editRecord.active===false;
      if(!activate&&!pendingDeactivate){setPendingDeactivate(true);setMessage('Confirm deactivation to proceed. Assigned teachers and enrolled students cannot be deactivated.');return;}
      const changed=setDemoPersonActive(editing,{id:editRecord.id,role:editRole,active:activate,classes,guardians});
      if(editRole==='teacher')onTeachers(changed);else onLearners(changed);
      setPendingDeactivate(false);
      setMessage(activate?'Fictional person reactivated.':'Fictional person deactivated. No records were deleted.');
    }catch(error){setPendingDeactivate(false);setMessage(error instanceof Error?error.message:'Could not change status');}
  }
  function enrollFromDirectory(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!directoryGroups.some(c=>c.id===directoryClass)){setMessage('Choose one of your visible sample classes');return;}
    handle(()=>enrollDemoLearnerForRole({classes,classId:directoryClass,learnerId:directoryLearner,learners:activeLearners,role,teacherId}),
      'Enrolled '+learnerName(directoryLearner)+' in the fictional class.');
  }
  function handle(operation:()=>ClassRoom[],success:string){
    try{onUpdate(operation());setMessage(success);}
    catch(error){setMessage(error instanceof Error?error.message:'Cannot update sample data');}
  }
  function addClass(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    handle(()=>createDemoClass(classes,{courseId,teacherId:assignedTeacherId,slot,capacity},activeTeachers),'Fictional class added. Nothing was stored.');
  }
  function chooseEditingClass(id:string){
    setEditClassId(id);
    const selected=classes.find(c=>c.id===id);
    if(selected){setEditTeacher(selected.teacherId);setEditSlot(selected.slot);setEditCapacity(selected.capacity);}
  }
  function saveEditingClass(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!canManage){setMessage('Administrator preview required for class edits');return;}
    handle(()=>updateDemoClass(classes,editClassId,{teacherId:editTeacher,slot:editSlot,capacity:editCapacity},
      {teachers:activeTeachers,sessions}), 'Updated fictional class details; the original course is preserved.');
  }
  function transferStudent(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!canManage){setMessage('Administrator preview required for transfers');return;}
    handle(()=>transferDemoLearner(classes,{fromClassId:transferFrom,toClassId:transferTo,learnerId:transferLearner},activeLearners),
      'Transferred the fictional learner between groups of the same course.');
  }
  const selectedTransferFrom=classes.find(c=>c.id===transferFrom);
  const possibleDestinations=classes.filter(c=>c.id!==transferFrom&&c.courseId===selectedTransferFrom?.courseId);
  function enroll(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const classroom=classes.find(c=>c.id===chosenClass);
    handle(()=>enrollDemoLearner(classes,chosenClass,chosenLearner,activeLearners),
      'Enrolled '+learnerName(chosenLearner)+' in '+courseName(classroom?.courseId??'')+' (demo only).');
  }
  if(view==='Directory')return <section className="panel operations" aria-label="Fictional people management">
    <span className="eyebrow">PEOPLE & ROLES · FICTIONAL DEMO ONLY</span>
    <h2>{canManage?'Manage teachers and students':'My class rosters and student enrollment'}</h2>
    <p>{canManage?'Create sample teacher and student directory entries, then assign them to groups. No login accounts are created.':'Enroll an existing fictional learner into one of the selected instructor’s assigned classes. Only administrators create people.'}</p>
    {canManage&&<div className="people-actions">
      <form className="people-form" onSubmit={createTeacher}>
        <h3>Add Teacher</h3>
        <label>Fictional teacher name<input ref={teacherInput} required maxLength={60} value={teacherDraft} onChange={e=>setTeacherDraft(e.target.value)} placeholder="Sample Teacher Delta" /></label>
        <button className="primary-btn" type="submit">+ Add Teacher</button>
      </form>
      <form className="people-form" onSubmit={createLearner}>
        <h3>Add Student</h3>
        <label>Fictional student name<input ref={studentInput} required maxLength={60} value={learnerDraft} onChange={e=>setLearnerDraft(e.target.value)} placeholder="Sample Learner Indigo" /></label>
        <button className="primary-btn" type="submit">+ Add Student</button>
      </form>
    </div>}
    {canManage&&<>
      <h3>Teacher directory ({teachers.length})</h3>
      <div className="people-grid">{teachers.map(teacher=><div className="person-tile" key={teacher.id}>
        <span className="student-token" aria-hidden="true">✳</span><div><strong>{teacher.name}{teacher.active===false?' (Inactive)':''}</strong>
          <small>{classes.filter(c=>c.teacherId===teacher.id).length} fictional groups · {teacher.id}</small>
        </div>
      </div>)}</div>
    </>}
    {canManage&&<div className="people-enroll">
      <h3>Edit or deactivate an added fictional person</h3>
      <p>Original seed people are read-only. Rename retains an ID; deactivation is reversible and blocked while assigned or enrolled.</p>
      <div className="ops-form">
        <label>Person type<select value={editRole} onChange={e=>{setEditRole(e.target.value as 'teacher'|'learner');setEditId('');setEditName('');setPendingDeactivate(false);}}>
          <option value="teacher">Teacher</option><option value="learner">Student</option>
        </select></label>
        <label>Newly added person<select value={editRecord?.id??''} onChange={e=>{setEditId(e.target.value);setEditName(editableEntries.find(p=>p.id===e.target.value)?.name??'');setPendingDeactivate(false);}}>
          <option value="">Choose a sample person</option>
          {editableEntries.map(p=><option key={p.id} value={p.id}>{p.name}{p.active===false?' · inactive':''}</option>)}
        </select></label>
      </div>
      {editRecord&&<><form className="ops-form" onSubmit={updatePerson}>
        <label>Fictional name<input value={editName} required maxLength={60} disabled={editRecord.active===false} onChange={e=>setEditName(e.target.value)}/></label>
        <button className="small-btn" type="submit" disabled={editRecord.active===false}>Save sample name</button>
      </form>
      <button className="small-btn" type="button" onClick={togglePerson}>
        {editRecord.active===false?'Reactivate sample person':pendingDeactivate?'Confirm deactivation':'Deactivate sample person'}
      </button>
      {pendingDeactivate&&<button className="text-btn" type="button" onClick={()=>{setPendingDeactivate(false);setMessage('Deactivation cancelled.');}}>Cancel</button>}
      </>}
    </div>}
    {(canManage||role==='Teacher')&&<>
      <h3>{canManage?'Students in directory':'Students in my groups'} ({canManage?learners.length:new Set(visible.flatMap(c=>c.learnerIds)).size})</h3>
      <div className="people-search">
        <label>Find fictional student<input type="search" value={studentSearch}
          onChange={e=>setStudentSearch(e.target.value)} placeholder="Search sample name or ID"/></label>
        <label>Student status<select value={studentStatus} onChange={e=>setStudentStatus(e.target.value as typeof studentStatus)}>
          <option value="all">All statuses</option><option value="active">Active</option>
          {canManage&&<option value="inactive">Inactive</option>}
          {canManage&&<option value="unenrolled">Active and unenrolled</option>}
        </select></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Fictional student</th><th>Enrolled groups</th><th>Subjects</th></tr></thead><tbody>
        {learners.filter(learner=>(canManage||visible.some(c=>c.learnerIds.includes(learner.id)))&&
          (learner.name.toLowerCase().includes(studentSearch.trim().toLowerCase())||learner.id.toLowerCase().includes(studentSearch.trim().toLowerCase()))&&
          (studentStatus==='all'||(studentStatus==='active'&&learner.active!==false)||
           (studentStatus==='inactive'&&learner.active===false)||
           (studentStatus==='unenrolled'&&learner.active!==false&&!classes.some(c=>c.learnerIds.includes(learner.id)))))
         .map(learner=>{
          const roster=visible.filter(c=>c.learnerIds.includes(learner.id));
          return <tr key={learner.id}><td>{learner.name}{learner.active===false?' (Inactive)':''}</td><td>{roster.length}</td>
            <td>{roster.length?roster.map(c=>courseName(c.courseId)).join(', '):'Not enrolled'}</td></tr>;
        })}
      </tbody></table></div>
      <div className="people-enroll">
        <h3>Enroll an existing student into {canManage?'a class':'my class'}</h3>
        <form className="ops-form" onSubmit={enrollFromDirectory}>
          <label>Class group<select value={directoryClass} required onChange={e=>setDirectoryClass(e.target.value)}>
            <option value="">Choose a class</option>{directoryGroups.map(c=><option value={c.id} key={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}
          </select></label>
          <label>Student<select value={directoryLearner} onChange={e=>setDirectoryLearner(e.target.value)}>
            {activeLearners.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}
          </select></label>
          <button className="primary-btn" type="submit">+ Enroll Student</button>
        </form>
      </div>
    </>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
    <p className="quiet">Use only fictional names beginning with “Sample Teacher” or “Sample Learner”. Refresh resets everyone you create. Guardians cannot self-link new children; their relationships require verification when the backend resumes.</p>
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
              onChange={e=>handle(()=>assignDemoTeacher(classes,c.id,e.target.value,activeTeachers),'Sample teacher assignment changed.')}>
            {activeTeachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>:teacherName(c.teacherId)}</td>
          <td>{c.slot}</td><td><span className={'tag '+(c.learnerIds.length===c.capacity?'amber':'green')}>{c.learnerIds.length}/{c.capacity}</span></td>
          <td><button className="text-btn" aria-expanded={manageClass===c.id} onClick={()=>setManageClass(manageClass===c.id?'':c.id)}>Roster {manageClass===c.id?'↑':'↓'}</button></td>
        </tr>)}
      </tbody></table></div>
      {displayed.length===0&&<p className="quiet">No fictional groups match this filter.</p>}
      {visible.filter(c=>manageClass===c.id).map(c=><div className="roster-detail" key={c.id}>
        <h3>{courseName(c.courseId)} · {c.id.toUpperCase()} roster</h3>
        <div className="roster-chips">
          {(role==='Student' ? c.learnerIds.filter(id=>id===learnerId) : c.learnerIds).map(id=><span className="roster-chip" key={id}>{learnerName(id)}
            {canManage&&<button aria-label={'Remove '+learnerName(id)+' from '+c.id} title="Remove fictional enrollment"
               onClick={()=>handle(()=>removeDemoLearner(classes,c.id,id),'Removed a fictional enrollment.')} type="button">×</button>}
          </span>)}
          {c.learnerIds.length===0&&<p>No sample learners enrolled yet.</p>}
        </div>
      </div>)}
      <p className="quiet">Role switcher is a visual preview only. These controls do not grant backend permissions.</p>
    </section>

    {canManage&&<div className="operations-grid">
      <section className="panel">
        <span className="eyebrow">CLASS MANAGEMENT · FICTIONAL CORRECTIONS</span>
        <h2>Edit an existing class</h2>
        <p>Change the teacher, meeting time, or seat limit without erasing its roster. Existing lessons and student clashes are checked.</p>
        <form className="ops-form" onSubmit={saveEditingClass}>
          <label>Class group<select required value={editClassId} onChange={e=>chooseEditingClass(e.target.value)}>
            <option value="">Choose a group</option>{classes.map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}
          </select></label>
          <label>Instructor<select disabled={!editClassId} value={editTeacher} onChange={e=>setEditTeacher(e.target.value)}>
            {activeTeachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <label>Weekly meeting slot<select disabled={!editClassId} value={editSlot} onChange={e=>setEditSlot(e.target.value)}>
            {DEMO_SLOTS.map(s=><option key={s} value={s}>{s}</option>)}
          </select></label>
          <label>Maximum seats<select disabled={!editClassId} value={editCapacity} onChange={e=>setEditCapacity(Number(e.target.value))}>
            {[5,10,15,20].map(n=><option key={n} value={n}>{n} seats</option>)}
          </select></label>
          <button disabled={!editClassId} className="primary-btn" type="submit">Save sample class changes</button>
        </form>
      </section>
      <section className="panel">
        <span className="eyebrow">STUDENT MANAGEMENT · SAME COURSE ONLY</span>
        <h2>Transfer a student</h2>
        <p>Move an existing fictional learner between groups of the same subject. No transfer occurs if the destination is full or conflicts with their timetable.</p>
        <form className="ops-form" onSubmit={transferStudent}>
          <label>From class<select required value={transferFrom} onChange={e=>{setTransferFrom(e.target.value);setTransferTo('');setTransferLearner('');}}>
            <option value="">Choose source group</option>{classes.filter(c=>c.learnerIds.length>0).map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}
          </select></label>
          <label>Student<select required value={transferLearner} onChange={e=>setTransferLearner(e.target.value)}>
            <option value="">Choose enrolled student</option>{selectedTransferFrom?.learnerIds.map(id=><option key={id} value={id}>{learnerName(id)}</option>)}
          </select></label>
          <label>To class<select required value={transferTo} onChange={e=>setTransferTo(e.target.value)}>
            <option value="">Choose same-course destination</option>{possibleDestinations.map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()} ({c.learnerIds.length}/{c.capacity})</option>)}
          </select></label>
          {!possibleDestinations.length&&transferFrom&&<p className="quiet">Create another group for this course to allow transfers.</p>}
          <button disabled={!transferLearner||!transferTo} className="primary-btn" type="submit">Transfer fictional student</button>
        </form>
      </section>
    </div>}
    {canManage&&<div className="operations-grid">
      <section className="panel"><span className="eyebrow">ADMINISTRATION · FICTIONAL DATA</span><h2>Create a sample class</h2>
        <form className="ops-form" onSubmit={addClass}>
          <label>Course<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{DEMO_COURSES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Assigned instructor<select value={assignedTeacherId} onChange={e=>setAssignedTeacherId(e.target.value)}>{activeTeachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Two weekly sessions<select value={slot} onChange={e=>setSlot(e.target.value)}>{DEMO_SLOTS.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label>Seat limit<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[5,10,15,20].map(x=><option key={x} value={x}>{x} seats</option>)}</select></label>
          <button type="submit" className="primary-btn">Create fictional group</button>
        </form>
      </section>
      <section className="panel"><span className="eyebrow">ADMINISTRATION · FICTIONAL DATA</span><h2>Enroll a sample learner</h2>
        <form className="ops-form" onSubmit={enroll}>
          <label>Class group<select required value={chosenClass} onChange={e=>setChosenClass(e.target.value)}><option value="">Choose a group</option>{classes.map(c=><option key={c.id} value={c.id}>{courseName(c.courseId)} · {c.id.toUpperCase()}</option>)}</select></label>
          <label>Fictional learner<select value={chosenLearner} onChange={e=>setChosenLearner(e.target.value)}>{activeLearners.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <button type="submit" className="primary-btn">Enroll in sample class</button>
        </form>
        <p className="quiet">Enrollment rejects duplicate course groups and full classes. Refreshing resets the preview.</p>
      </section>
    </div>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
    {role==='Student'&&<p className="quiet">Selected learner attends {enrolledClassCount(classes,learnerId)} illustrative class groups.</p>}
  </div>;
}
