/** Original browser-only course catalog. Course IDs remain stable; archive never deletes history. */
import {DEMO_COURSES} from './operations.mjs';
import {DEMO_SYLLABUS} from './academics.mjs';
import {DEMO_QUIZ_BANK} from './assessments.mjs';
const DETAILS={
 computer:{topic:'Hardware, files and basic troubleshooting',icon:'◈',activity:'Identify the CPU, RAM and SSD in a computer diagram.'},
 creative:{topic:'Canva, layout and visual storytelling',icon:'✳',activity:'Design a poster with three colors and one clear headline.'},
 ai:{topic:'Prompt engineering and responsible AI',icon:'✦',activity:'Improve a vague prompt by adding the role, task and audience.'},
 automation:{topic:'Spreadsheets, webhooks and simple workflows',icon:'⌘',activity:'Outline the steps of a sample homework-help automation.'},
 scratch:{topic:'Creative stories, games and digital logic',icon:'▧',activity:'Plan a short interactive story with two sprites.'}
};
function quizFor(name){return [
 {prompt:'What is a good first step when learning '+name+'?',options:['Practice the basics','Skip the instructions','Avoid examples'],answer:0},
 {prompt:'What should you do when an instruction is unclear?',options:['Guess without checking','Ask for clarification or check an example','Stop learning'],answer:1}
];}
export function initialDemoCourses(){return DEMO_COURSES.map(course=>({...course,...DETAILS[course.id],
 syllabus:[...(DEMO_SYLLABUS[course.id]??[])],
 quizQuestions:(DEMO_QUIZ_BANK[course.id]??quizFor(course.name)).map(q=>({...q,options:[...q.options]})),
 active:true,custom:false}));}
function normalizeSyllabus(syllabus){
 if(!Array.isArray(syllabus))throw Error('Enter 3–8 course modules, one per line');
 const clean=syllabus.map(s=>typeof s==='string'?s.trim():'');
 if(clean.length<3||clean.length>8||clean.some(s=>s.length<3||s.length>80))throw Error('Add 3–8 module names; each must be 3–80 characters');
 if(new Set(clean.map(s=>s.toLocaleLowerCase('en'))).size!==clean.length)throw Error('Module names must be unique');
 return clean;
}
function validateCourse({name,topic,activity,syllabus},courses,exceptId=''){
 if(typeof name!=='string'||name.trim().length<5||name.trim().length>70)throw Error('Course name must contain 5–70 characters');
 if(typeof topic!=='string'||topic.trim().length<8||topic.trim().length>180)throw Error('Course description must contain 8–180 characters');
 if(typeof activity!=='string'||activity.trim().length<8||activity.trim().length>240)throw Error('Practice activity must contain 8–240 characters');
 const cleanName=name.trim().replace(/\s+/g,' ');
 if(courses.some(c=>c.id!==exceptId&&c.name.toLocaleLowerCase('en')===cleanName.toLocaleLowerCase('en')))throw Error('A course with this name already exists');
 return {name:cleanName,topic:topic.trim(),activity:activity.trim(),syllabus:normalizeSyllabus(syllabus)};
}
export function createDemoCourse(courses,input){
 if(courses.length>=100)throw Error('Course catalog demo limit reached');
 const values=validateCourse(input,courses);const used=new Set(courses.map(c=>c.id));let n=1;
 while(used.has('course-demo-'+n))n++;
 return [...courses,{id:'course-demo-'+n,...values,icon:'✦',quizQuestions:quizFor(values.name),active:true,custom:true}];
}
export function updateDemoCourse(courses,courseId,input){
 const current=courses.find(c=>c.id===courseId);if(!current)throw Error('Choose an existing sample course');
 const values=validateCourse(input,courses,courseId);
 return courses.map(c=>c.id===courseId?{...c,...values,quizQuestions:c.custom?quizFor(values.name):c.quizQuestions}:c);
}
export function setDemoCourseActive(courses,courseId,active){
 if(typeof active!=='boolean')throw Error('Choose an active or archived state');
 if(!courses.some(c=>c.id===courseId))throw Error('Choose an existing sample course');
 if(!active&&courses.filter(c=>c.active!==false).length<=1)throw Error('Keep at least one active course in the catalog');
 return courses.map(c=>c.id===courseId?{...c,active}:c);
}
