/** Optional profile details for fictional people. Pure helpers; no identity or contact data is stored. */
export const GRADE_LEVELS=Object.freeze(['Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10']);
const clean=v=>typeof v==='string'?v.trim().replace(/\s+/g,' '):'';

/** Update profile fields on an existing (active) person; ids and names are unchanged. */
export function updatePersonProfile(people,id,role,fields){
  const person=people.find(p=>p.id===id);
  if(!person)throw Error('Choose an existing sample person');
  if(person.active===false)throw Error('Reactivate this person before editing');
  const note=clean(fields.note);
  if(note.length>120)throw Error('Notes can be at most 120 characters');
  if(/[<>@]/.test(note))throw Error('Notes cannot contain markup or email-like text');
  const next={note};
  if(role==='learner'){
    const grade=clean(fields.gradeLevel);
    if(grade&&!GRADE_LEVELS.includes(grade))throw Error('Choose a valid grade level');
    next.gradeLevel=grade;
  }else{
    const specialty=clean(fields.specialty);
    if(specialty.length>40)throw Error('Specialty can be at most 40 characters');
    if(/[<>@]/.test(specialty))throw Error('Specialty cannot contain markup or email-like text');
    next.specialty=specialty;
  }
  return people.map(p=>p.id===id?{...p,...next}:p);
}

/**
 * Read-only detail summary for a teacher or learner from existing records.
 * @param {'teacher'|'learner'} role
 * @param {string} id
 * @param {{classes:any[],courses:any[],guardians?:any[],ledger?:any[],learners?:any[]}} context
 * @returns {{classes:Array<{id:string,course:string,slot:string,enrolled?:number,capacity?:number}>,learnerCount?:number,guardians?:string[],feeRows?:number,name?:string}}
 */
export function personDetails(role,id,{classes,courses,guardians=[],ledger=[],learners=[]}){
  const courseName=cid=>courses.find(c=>c.id===cid)?.name??'Unknown course';
  if(role==='teacher'){
    const mine=classes.filter(c=>c.teacherId===id);
    return {classes:mine.map(c=>({id:c.id,course:courseName(c.courseId),slot:c.slot,enrolled:c.learnerIds.length,capacity:c.capacity})),
      learnerCount:new Set(mine.flatMap(c=>c.learnerIds)).size};
  }
  const mine=classes.filter(c=>c.learnerIds.includes(id));
  return {classes:mine.map(c=>({id:c.id,course:courseName(c.courseId),slot:c.slot})),
    guardians:guardians.filter(g=>g.learnerIds.includes(id)).map(g=>g.name??g.id),
    feeRows:ledger.filter(r=>r.learnerId===id).length,
    name:learners.find(l=>l.id===id)?.name};
}
