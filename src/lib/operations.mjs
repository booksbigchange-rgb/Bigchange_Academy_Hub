/**
 * Original, browser-only classroom workflow model using fictional identities.
 * DO NOT connect to live student data or mistake preview roles for authorization.
 */
export const DEMO_COURSES = Object.freeze([
  {id:'computer',name:'Computer Foundations'},
  {id:'creative',name:'Creative Design'},
  {id:'ai',name:'Introduction to AI'},
  {id:'automation',name:'AI & Automation'},
  {id:'scratch',name:'Scratch Studio'}
]);
export const DEMO_TEACHERS = Object.freeze([
  {id:'teacher-a',name:'Instructor A'},
  {id:'teacher-b',name:'Instructor B'},
  {id:'teacher-c',name:'Instructor C'}
]);
export const DEMO_LEARNERS = Object.freeze(
  'ABCDEFGHIJKLMNOP'.split('').map(letter=>({id:'learner-'+letter.toLowerCase(),name:'Learner '+letter}))
);
export const DEMO_SLOTS = Object.freeze([
  'Mon + Wed · 16:00', 'Tue + Thu · 16:00', 'Sat + Sun · 10:00', 'Mon + Wed · 10:00'
]);
/** @typedef {{id:string,courseId:string,teacherId:string,slot:string,capacity:number,learnerIds:string[]}} DemoClass */
/** @type {DemoClass[]} */
export const INITIAL_DEMO_CLASSES = [
  {id:'class-1',courseId:'computer',teacherId:'teacher-a',slot:'Mon + Wed · 16:00',capacity:10,learnerIds:['learner-a','learner-b','learner-c']},
  {id:'class-2',courseId:'creative',teacherId:'teacher-b',slot:'Tue + Thu · 16:00',capacity:10,learnerIds:['learner-a','learner-d']},
  {id:'class-3',courseId:'ai',teacherId:'teacher-a',slot:'Sat + Sun · 10:00',capacity:10,learnerIds:['learner-c','learner-e','learner-f']},
  {id:'class-4',courseId:'scratch',teacherId:'teacher-c',slot:'Mon + Wed · 10:00',capacity:10,learnerIds:['learner-g','learner-h']}
];
function allowed(items,id){return items.some(item=>item.id===id&&item.active!==false);}
function addFictionalPerson(items,name,role,max){
  if(!Array.isArray(items))throw Error('Invalid sample directory');
  if(typeof name!=='string')throw Error('Enter a fictional sample name');
  const clean=name.trim().replace(/\s+/g,' ');
  if(clean.length<10||clean.length>60||!(role==='teacher'?/^Sample Teacher [\w -]+$/i:/^Sample Learner [\w -]+$/i).test(clean))
    throw Error('Use a fictional name beginning with Sample '+(role==='teacher'?'Teacher ':'Learner '));
  if(items.some(x=>x.name.toLocaleLowerCase('en')===clean.toLocaleLowerCase('en')))
    throw Error('A sample person with this name already exists');
  if(items.length>=max)throw Error('Sample directory limit reached');
  const ids=new Set(items.map(x=>x.id));
  let n=1;while(ids.has(role+'-demo-'+n))n++;
  return [...items,{id:role+'-demo-'+n,name:clean}];
}
export function addDemoTeacher(teachers,name){return addFictionalPerson(teachers,name,'teacher',100);}
export function addDemoLearner(learners,name){return addFictionalPerson(learners,name,'learner',3000);}

/** Only administrator-created fictional people may be renamed/deactivated. Seed fixtures stay stable. */
export function renameDemoPerson(people,id,name,role){
  const person=people.find(p=>p.id===id);
  if(!person||!id.startsWith(role+'-demo-'))throw Error('Only added sample people can be edited');
  if(person.active===false)throw Error('Reactivate this sample person before editing');
  const existing=people.filter(p=>p.id!==id);
  const valid=addFictionalPerson(existing,name,role,role==='teacher'?100:3000).at(-1);
  return people.map(p=>p.id===id?{...p,name:valid.name}:p);
}
export function setDemoPersonActive(people,{id,role,active,classes}){
  const person=people.find(p=>p.id===id);
  if(!person||!id.startsWith(role+'-demo-'))throw Error('Only newly added sample people can be deactivated');
  if(typeof active!=='boolean')throw Error('Choose an active state');
  if(!active&&role==='teacher'&&classes.some(c=>c.teacherId===id))
    throw Error('Reassign this teacher’s classes before deactivation');
  if(!active&&role==='learner'&&classes.some(c=>c.learnerIds.includes(id)))
    throw Error('Remove student enrollments before deactivation');
  return people.map(p=>p.id===id?{...p,active}:p);
}
export const activeDemoPeople=people=>people.filter(p=>p.active!==false);

function validateUniqueSlot(classes,teacherId,slot,exceptId=''){
  if(classes.some(item=>item.teacherId===teacherId && item.slot===slot && item.id!==exceptId))
    throw Error('Instructor already teaches another sample class at this time');
}
function assertRoster(classes) {
  if(!Array.isArray(classes)||classes.some(c=>!Array.isArray(c.learnerIds))) throw Error('Invalid sample class list');
}
/** @param {DemoClass[]} classes @param {{courseId:string,teacherId:string,slot:string,capacity:number}} next @returns {DemoClass[]} */
export function createDemoClass(classes,next,teachers=DEMO_TEACHERS){
  assertRoster(classes);
  if(classes.length>=300)throw Error('Sample preview limit reached (300 groups)');
  if(!allowed(DEMO_COURSES,next.courseId)||!allowed(teachers,next.teacherId)||!DEMO_SLOTS.includes(next.slot))throw Error('Choose valid course, instructor and session time');
  if(![5,10,15,20].includes(next.capacity))throw Error('Choose a valid class capacity');
  validateUniqueSlot(classes,next.teacherId,next.slot);
  const used=new Set(classes.map(c=>c.id));
  let idNumber=1;
  while(used.has('class-'+idNumber))idNumber++;
  return [...classes,{id:'class-'+idNumber,courseId:next.courseId,teacherId:next.teacherId,slot:next.slot,capacity:next.capacity,learnerIds:[]}];
}
/** @param {DemoClass[]} classes @param {string} classId @param {string} learnerId @returns {DemoClass[]} */
export function enrollDemoLearner(classes,classId,learnerId,learners=DEMO_LEARNERS){
  assertRoster(classes);
  if(!allowed(learners,learnerId))throw Error('Choose a fictional learner');
  const target=classes.find(c=>c.id===classId);
  if(!target)throw Error('Class not found');
  if(target.learnerIds.includes(learnerId))throw Error('Learner is already enrolled in this class');
  if(target.learnerIds.length>=target.capacity)throw Error('Class is at capacity');
  if(classes.some(c=>c.courseId===target.courseId && c.learnerIds.includes(learnerId)))
    throw Error('Learner is already enrolled in another group for this course');
  if(classes.some(c=>c.id!==classId && c.slot===target.slot && c.learnerIds.includes(learnerId)))
    throw Error('Learner already attends a different sample class at this same weekly time');
  return classes.map(c=>c.id===classId?{...c,learnerIds:[...c.learnerIds,learnerId]}:c);
}
/**
 * Demo-only role guard for student enrollment. This is NOT backend authorization.
 * In this limited preview Teacher always represents fictitious Instructor A.
 */
export function enrollDemoLearnerForRole({classes,classId,learnerId,learners=DEMO_LEARNERS,role,teacherId='teacher-a'}){
  if(role!=='Administrator'&&role!=='Teacher')throw Error('This preview role cannot enroll students');
  const classroom=classes.find(c=>c.id===classId);
  if(!classroom)throw Error('Class not found');
  if(role==='Teacher'&&classroom.teacherId!==teacherId)
    throw Error('Teachers may enroll only into their assigned sample groups');
  return enrollDemoLearner(classes,classId,learnerId,learners);
}
/** @param {DemoClass[]} classes @param {string} classId @param {string} learnerId @returns {DemoClass[]} */
export function removeDemoLearner(classes,classId,learnerId){
  assertRoster(classes);
  const target=classes.find(c=>c.id===classId);
  if(!target||!target.learnerIds.includes(learnerId))throw Error('Enrollment not found');
  return classes.map(c=>c.id===classId?{...c,learnerIds:c.learnerIds.filter(id=>id!==learnerId)}:c);
}
/** @param {DemoClass[]} classes @param {string} classId @param {string} teacherId @returns {DemoClass[]} */
export function assignDemoTeacher(classes,classId,teacherId,teachers=DEMO_TEACHERS){
  assertRoster(classes);
  if(!allowed(teachers,teacherId))throw Error('Choose a sample instructor');
  const target=classes.find(c=>c.id===classId);
  if(!target)throw Error('Class not found');
  validateUniqueSlot(classes,teacherId,target.slot,classId);
  return classes.map(c=>c.id===classId?{...c,teacherId}:c);
}

/**
 * Admin-only model operation for a class timetable/teacher/seat-limit correction.
 * Existing lesson dates are preserved and must still fall on meeting weekdays.
 * Never silently move learners into overlapping classes.
 */
export function updateDemoClass(classes,classId,{teacherId,slot,capacity},{teachers=DEMO_TEACHERS,sessions=[]}={}){
  assertRoster(classes);
  const previous=classes.find(c=>c.id===classId);
  if(!previous)throw Error('Class group not found');
  if(!allowed(teachers,teacherId))throw Error('Choose an active sample instructor');
  if(!DEMO_SLOTS.includes(slot))throw Error('Choose an existing sample meeting slot');
  if(![5,10,15,20].includes(capacity))throw Error('Choose a valid class capacity');
  if(capacity<previous.learnerIds.length)throw Error('Seat limit cannot fall below current enrollments');
  validateUniqueSlot(classes,teacherId,slot,classId);
  if(slot!==previous.slot){
    const allowedDays=slot.split(' · ')[0].split(' + ');
    const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    if(sessions.some(s=>s.classId===classId&&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!allowedDays.includes(weekdays[new Date(s.date+'T00:00:00Z').getUTCDay()]))))
      throw Error('Existing lessons use different meeting days; keep the days or revise those lessons first');
    for(const learnerId of previous.learnerIds){
      if(classes.some(c=>c.id!==classId&&c.slot===slot&&c.learnerIds.includes(learnerId)))
        throw Error('A learner in this class already attends another group in that weekly slot');
    }
  }
  return classes.map(c=>c.id===classId?{...c,teacherId,slot,capacity}:c);
}

/**
 * Move one learner between two groups of the SAME course in one immutable operation.
 * Invalid destinations leave both rosters unchanged.
 */
export function transferDemoLearner(classes,{fromClassId,toClassId,learnerId},learners=DEMO_LEARNERS){
  assertRoster(classes);
  if(fromClassId===toClassId)throw Error('Choose two different class groups');
  const from=classes.find(c=>c.id===fromClassId),to=classes.find(c=>c.id===toClassId);
  if(!from||!to)throw Error('Choose existing class groups');
  if(!from.learnerIds.includes(learnerId))throw Error('Learner is not enrolled in the source group');
  if(from.courseId!==to.courseId)throw Error('Transfer must stay within the same course');
  const without=removeDemoLearner(classes,fromClassId,learnerId);
  // Validate target seat limit, collisions and duplicate-course enrollment atomically.
  return enrollDemoLearner(without,toClassId,learnerId,learners);
}

/** @param {DemoClass[]} classes @param {'Student'|'Teacher'|'Administrator'} role @returns {DemoClass[]} */
export function visibleDemoClasses(classes,role,{teacherId='teacher-a',learnerId='learner-a'}={}){
  if(role==='Administrator')return classes;
  if(role==='Teacher')return classes.filter(c=>c.teacherId===teacherId);
  if(role==='Student')return classes.filter(c=>c.learnerIds.includes(learnerId));
  return [];
}
/** @param {DemoClass[]} classes @param {string} learnerId */
export function enrolledClassCount(classes,learnerId){return classes.filter(c=>c.learnerIds.includes(learnerId)).length;}
