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
function allowed(items,id){return items.some(item=>item.id===id);}
function addFictionalPerson(items,name,role,max){
  if(!Array.isArray(items))throw Error('Invalid sample directory');
  if(typeof name!=='string')throw Error('Enter a fictional sample name');
  const clean=name.trim().replace(/\s+/g,' ');
  if(clean.length<10||clean.length>60||!/^Sample (?:Teacher|Learner) [\w -]+$/i.test(clean))
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
  return classes.map(c=>c.id===classId?{...c,learnerIds:[...c.learnerIds,learnerId]}:c);
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
/** @param {DemoClass[]} classes @param {'Student'|'Teacher'|'Administrator'} role @returns {DemoClass[]} */
export function visibleDemoClasses(classes,role){
  if(role==='Administrator')return classes;
  if(role==='Teacher')return classes.filter(c=>c.teacherId==='teacher-a');
  if(role==='Student')return classes.filter(c=>c.learnerIds.includes('learner-a'));
  return [];
}
/** @param {DemoClass[]} classes @param {string} learnerId */
export function enrolledClassCount(classes,learnerId){return classes.filter(c=>c.learnerIds.includes(learnerId)).length;}
