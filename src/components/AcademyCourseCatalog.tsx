import {useState,type FormEvent} from 'react';
import {createDemoCourse,updateDemoCourse,setDemoCourseActive} from '../lib/course-catalog.mjs';
export type CourseRecord={id:string;name:string;topic:string;icon:string;activity:string;syllabus:string[];
 quizQuestions:{prompt:string;options:string[];answer:number}[];active?:boolean;custom?:boolean};
type Props={courses:CourseRecord[];classes:{courseId:string}[];onChange:(next:CourseRecord[])=>void};
const modulesText=(course:CourseRecord)=>course.syllabus.join('\n');
export default function AcademyCourseCatalog({courses,classes,onChange}:Props){
 const [name,setName]=useState('Digital Storytelling');
 const [topic,setTopic]=useState('Plan and communicate a clear story using digital tools.');
 const [activity,setActivity]=useState('Create a short story with a beginning, middle and end.');
 const [syllabusText,setSyllabusText]=useState('Story structure\nVisual planning\nDigital creation\nReview and improve');
 const [editingId,setEditingId]=useState('');
 const [editName,setEditName]=useState('');
 const [editTopic,setEditTopic]=useState('');
 const [editActivity,setEditActivity]=useState('');
 const [editSyllabus,setEditSyllabus]=useState('');
 const [message,setMessage]=useState('');
 const activeCount=courses.filter(c=>c.active!==false).length;
 const groupsFor=(id:string)=>classes.filter(c=>c.courseId===id).length;
 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  try{onChange(createDemoCourse(courses,{name,topic,activity,syllabus:syllabusText.split('\n').map(x=>x.trim()).filter(Boolean)}));
   setMessage('Created a fictional course. It is now available for new class groups.');
   setName('');setTopic('');setActivity('');setSyllabusText('Module one\nModule two\nModule three');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not create sample course');}
 }
 function startEdit(course:CourseRecord){
  setEditingId(course.id);setEditName(course.name);setEditTopic(course.topic);setEditActivity(course.activity);
  setEditSyllabus(modulesText(course));setMessage('');
 }
 function saveEdit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  try{onChange(updateDemoCourse(courses,editingId,{name:editName,topic:editTopic,activity:editActivity,
    syllabus:editSyllabus.split('\n').map(x=>x.trim()).filter(Boolean)}));
   setEditingId('');setMessage('Updated course details. Existing groups, lesson plans and assessments keep their stable course ID.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not update sample course');}
 }
 function toggle(course:CourseRecord){
  try{onChange(setDemoCourseActive(courses,course.id,course.active===false));
   setMessage(course.active===false?'Reactivated course for new groups.':'Archived course for new groups; existing classes and records remain.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not change course status');}
 }
 return <div className="course-catalog-workspace">
  <section className="panel"><span className="eyebrow">ADMINISTRATION · FICTIONAL COURSE CATALOG</span><h2>Create a course</h2>
   <p>Courses can include modules and a practice activity. New courses become available when creating class groups. No real curriculum is published.</p>
   <form className="course-catalog-form" onSubmit={create}>
    <label>Course name<input value={name} onChange={e=>setName(e.target.value)} minLength={5} maxLength={70} required/></label>
    <label>Short description<input value={topic} onChange={e=>setTopic(e.target.value)} minLength={8} maxLength={180} required/></label>
    <label>Practice activity<input value={activity} onChange={e=>setActivity(e.target.value)} minLength={8} maxLength={240} required/></label>
    <label className="course-modules-field">Modules (one per line; 3–8)<textarea value={syllabusText} onChange={e=>setSyllabusText(e.target.value)} rows={4} required/></label>
    <button className="primary-btn" type="submit">+ Create course</button>
   </form>
  </section>
  <section className="panel"><div className="panel-head"><div><span className="eyebrow">CATALOG OVERVIEW</span><h2>Manage courses</h2></div>
   <div className="course-catalog-count">{activeCount} active · {courses.length-activeCount} archived</div></div>
   <p>Archive hides a course from new class creation; it does not delete current classes, attendance, grades or reports.</p>
   <div className="course-catalog-list">
    {courses.map(course=><article className="course-catalog-card" key={course.id}>
     <div className="course-catalog-card-head"><span className="course-catalog-icon" aria-hidden="true">{course.icon}</span>
      <div className="course-catalog-main"><h3>{course.name}</h3><p>{course.topic}</p>
       <div className="course-catalog-meta"><span>{course.syllabus.length} modules</span><span>{groupsFor(course.id)} class groups</span>
        <span className={course.active===false?'course-status archived':'course-status'}>{course.active===false?'Archived':'Active'}</span></div>
      </div>
      <div className="course-catalog-actions">
       <button className="small-btn" type="button" aria-expanded={editingId===course.id}
        onClick={()=>editingId===course.id?setEditingId(''):startEdit(course)}>{editingId===course.id?'Cancel':'Edit details'}</button>
       <button className="text-btn" type="button" onClick={()=>toggle(course)}>{course.active===false?'Reactivate':'Archive'}</button>
      </div>
     </div>
     {editingId===course.id&&<form className="course-catalog-form course-catalog-editor" onSubmit={saveEdit}>
      <label>Course name<input value={editName} onChange={e=>setEditName(e.target.value)} minLength={5} maxLength={70} required/></label>
      <label>Short description<input value={editTopic} onChange={e=>setEditTopic(e.target.value)} minLength={8} maxLength={180} required/></label>
      <label>Practice activity<input value={editActivity} onChange={e=>setEditActivity(e.target.value)} minLength={8} maxLength={240} required/></label>
      <label className="course-modules-field">Modules (one per line; 3–8)<textarea value={editSyllabus} onChange={e=>setEditSyllabus(e.target.value)} rows={4} required/></label>
      <button className="primary-btn" type="submit">Save course details</button>
     </form>}
    </article>)}
   </div>
   <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>
 </div>;
}
