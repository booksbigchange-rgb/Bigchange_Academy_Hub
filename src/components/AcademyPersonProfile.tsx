import {useState,type FormEvent} from 'react';
import {GRADE_LEVELS,personDetails,updatePersonProfile} from '../lib/profiles.mjs';
import type {Person,ClassRoom} from './AcademyOperations';
import type {CourseRecord} from './AcademyCourseCatalog';
type P=Person&{gradeLevel?:string;specialty?:string;note?:string};
type Props={role:'teacher'|'learner';people:P[];classes:ClassRoom[];courses:CourseRecord[];
 guardians:{id:string;name?:string;learnerIds:string[]}[];feeRowCount?:(id:string)=>number;canEdit:boolean;onChange:(next:P[])=>void};
export default function AcademyPersonProfile({role,people,classes,courses,guardians,canEdit,onChange}:Props){
 const [id,setId]=useState('');
 const [grade,setGrade]=useState('');const [specialty,setSpecialty]=useState('');const [note,setNote]=useState('');
 const [message,setMessage]=useState('');
 const person=people.find(p=>p.id===id);
 const info=person?personDetails(role,person.id,{classes,courses,guardians}):null;
 function choose(value:string){
  setId(value);setMessage('');
  const p=people.find(x=>x.id===value);
  setGrade(p?.gradeLevel??'');setSpecialty(p?.specialty??'');setNote(p?.note??'');
 }
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  try{
   onChange(updatePersonProfile(people,id,role,{gradeLevel:grade,specialty,note}));
   setMessage('Profile saved for this browser session only.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not save profile');}
 }
 const label=role==='teacher'?'teacher':'student';
 return <div className="people-enroll" aria-label={'Fictional '+label+' details'}>
  <h3>{canEdit?'View and edit ':'View '}{label} details</h3>
  <label>Fictional {label}<select value={id} onChange={e=>choose(e.target.value)}>
   <option value="">Choose a {label}</option>
   {people.map(p=><option key={p.id} value={p.id}>{p.name}{p.active===false?' · inactive':''}</option>)}
  </select></label>
  {person&&info&&<>
   <dl className="detail-list">
    <div><dt>Status</dt><dd>{person.active===false?'Inactive':'Active'}</dd></div>
    <div><dt>{role==='teacher'?'Specialty':'Grade level'}</dt><dd>{(role==='teacher'?person.specialty:person.gradeLevel)||'Not set'}</dd></div>
    <div><dt>Note</dt><dd>{person.note||'None'}</dd></div>
    <div><dt>Class groups</dt><dd>{info.classes.length?info.classes.map(c=>c.course+' · '+c.slot).join('; '):'None'}</dd></div>
    {role==='teacher'?<div><dt>Students taught</dt><dd>{info.learnerCount}</dd></div>
     :<div><dt>Linked guardians</dt><dd>{info.guardians?.length?info.guardians.join(', '):'None'}</dd></div>}
   </dl>
   {canEdit&&<form className="ops-form" onSubmit={save}>
    {role==='learner'
     ?<label>Grade level<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Not set</option>
       {GRADE_LEVELS.map(g=><option key={g}>{g}</option>)}</select></label>
     :<label>Specialty<input maxLength={40} value={specialty} onChange={e=>setSpecialty(e.target.value)}/></label>}
    <label>Note (max 120)<input maxLength={120} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button className="small-btn" type="submit" disabled={person.active===false}>Save details</button>
   </form>}
  </>}
  <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
 </div>;
}
