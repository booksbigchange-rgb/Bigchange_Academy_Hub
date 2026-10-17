import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_DEMO_CLASSES,createDemoClass} from '../src/lib/operations.mjs';
import {
  INITIAL_DEMO_TERMS,INITIAL_DEMO_SESSIONS,INITIAL_DEMO_ACADEMICS,INITIAL_DEMO_ATTENDANCE,
  createDemoTerm,createDemoSession,reviseDemoSession,markDemoSessionAttendance,sessionSummary,availableSyllabus
} from '../src/lib/academics.mjs';
const groups=()=>structuredClone(INITIAL_DEMO_CLASSES);
const academic=()=>structuredClone(INITIAL_DEMO_ACADEMICS);
test('terms enforce real dates, 28–125-day range, unique nonoverlapping periods',()=>{
  const terms=structuredClone(INITIAL_DEMO_TERMS);
  const result=createDemoTerm(terms,{label:'Apr–Jun 2027 · Sample',start:'2027-04-01',end:'2027-06-30'});
  assert.equal(result.length,3);
  assert.equal(terms.length,2);
  assert.throws(()=>createDemoTerm(terms,{label:'Overlap period',start:'2026-12-20',end:'2027-01-30'}),/overlap/);
  assert.throws(()=>createDemoTerm(terms,{label:'Too short term',start:'2027-05-01',end:'2027-05-14'}),/28/);
  assert.throws(()=>createDemoTerm(terms,{label:'Invalid date range',start:'2027-02-30',end:'2027-04-20'}));
  assert.throws(()=>createDemoTerm(terms,{label:'Date reversed',start:'2027-07-01',end:'2027-06-30'}));
});
test('class-specific lesson date must belong to term and meet on a scheduled weekday',()=>{
  const current=academic();
  const added=createDemoSession(groups(),current.terms,current.sessions,{
    classId:'class-1',termId:'term-autumn-2026',date:'2026-10-26',topic:'Digital safety',objective:'Identify one unsafe website and describe a safe response.'
  });
  assert.equal(added.length,INITIAL_DEMO_SESSIONS.length+1);
  assert.equal(current.sessions.length,INITIAL_DEMO_SESSIONS.length);
  assert.throws(()=>createDemoSession(groups(),current.terms,current.sessions,{
    classId:'class-1',termId:'term-autumn-2026',date:'2026-10-27',topic:'Digital safety',objective:'Discuss online safety.'}),/meeting days/);
  assert.throws(()=>createDemoSession(groups(),current.terms,current.sessions,{
    classId:'class-1',termId:'term-autumn-2026',date:'2026-10-19',topic:'Digital safety',objective:'Discuss online safety.'}),/already has/);
  assert.throws(()=>createDemoSession(groups(),current.terms,current.sessions,{
    classId:'class-1',termId:'term-autumn-2026',date:'2027-01-04',topic:'Digital safety',objective:'Discuss online safety.'}),/within this term/);
});
test('lesson creation rejects non-existent groups, terms and meaningless learning goals',()=>{
  const a=academic();
  const make=(changes={})=>createDemoSession(groups(),a.terms,a.sessions,{
    classId:'class-1',termId:'term-autumn-2026',date:'2026-10-26',topic:'Digital safety',objective:'Discuss online safety.',...changes
  });
  assert.throws(()=>make({classId:'class-999'}),/class group/);
  assert.throws(()=>make({termId:'not-a-term'}),/academic term/);
  assert.throws(()=>make({topic:'  '}),/Topic/);
  assert.throws(()=>make({objective:'tiny'}),/learning goal/);
  assert.ok(availableSyllabus('computer').length>=4);
  assert.throws(()=>availableSyllabus('fake'));
});
test('editing plans changes one session without changing the shared fixture',()=>{
  const current=academic();
  const changed=reviseDemoSession(current.sessions,'session-1',{topic:'Revised module',objective:'Identify five imaginary computer parts.'});
  assert.equal(changed.find(s=>s.id==='session-1').topic,'Revised module');
  assert.equal(current.sessions.find(s=>s.id==='session-1').topic,'Computer parts & care');
  assert.equal(changed.find(s=>s.id==='session-2').topic,current.sessions.find(s=>s.id==='session-2').topic);
  assert.throws(()=>reviseDemoSession(current.sessions,'bad',{topic:'Module',objective:'Valid goal sentence.'}));
});
test('attendance belongs to a single session and is immutable with before/after history',()=>{
  const state=academic();
  const result=markDemoSessionAttendance(state,{classes:groups(),sessions:state.sessions,sessionId:'session-1',learnerId:'learner-a',status:'Absent'});
  assert.equal(result.attendance.find(x=>x.sessionId==='session-1'&&x.learnerId==='learner-a').status,'Absent');
  assert.equal(state.attendance.find(x=>x.sessionId==='session-1'&&x.learnerId==='learner-a').status,'Present');
  assert.equal(result.history.length,1);
  assert.deepEqual({before:result.history[0].before,after:result.history[0].after},{before:'Present',after:'Absent'});
  const separate=markDemoSessionAttendance(result,{classes:groups(),sessions:state.sessions,sessionId:'session-2',learnerId:'learner-a',status:'Excused'});
  assert.equal(separate.attendance.find(x=>x.sessionId==='session-1'&&x.learnerId==='learner-a').status,'Absent');
  assert.equal(separate.attendance.find(x=>x.sessionId==='session-2'&&x.learnerId==='learner-a').status,'Excused');
  assert.equal(separate.history[1].before,'Unmarked');
  assert.equal(INITIAL_DEMO_ATTENDANCE.length,3);
});
test('non-enrolled learners, unknown sessions, and illegal marks are rejected',()=>{
  const state=academic();
  const mark=(overrides={})=>markDemoSessionAttendance(state,{classes:groups(),sessions:state.sessions,sessionId:'session-1',learnerId:'learner-a',status:'Late',...overrides});
  assert.throws(()=>mark({sessionId:'session-404'}),/Unknown/);
  assert.throws(()=>mark({learnerId:'learner-h'}),/not enrolled/);
  assert.throws(()=>mark({status:'Other'}),/valid attendance/);
  assert.throws(()=>mark({status:'Present'}),/already marked/);
});
test('attendance counts unmarked learner seats for precisely one session',()=>{
  const state=academic();
  const sum=sessionSummary(state.attendance,'session-1',groups()[0].learnerIds);
  assert.deepEqual(sum,{total:3,present:1,absent:1,late:1,excused:0,unmarked:0});
  const next=sessionSummary(state.attendance,'session-2',groups()[0].learnerIds);
  assert.equal(next.unmarked,3);
  assert.equal(next.present,0);
});
test('new M1 classes can also schedule sessions in M2',()=>{
  const created=createDemoClass(groups(),{courseId:'automation',teacherId:'teacher-b',slot:'Mon + Wed · 10:00',capacity:10});
  const terms=structuredClone(INITIAL_DEMO_TERMS);
  const sessions=createDemoSession(created,terms,structuredClone(INITIAL_DEMO_SESSIONS),{
    classId:created.at(-1).id,termId:'term-autumn-2026',date:'2026-10-26',
    topic:'Spreadsheet inputs',objective:'Identify three cells in a fictional spreadsheet.'
  });
  assert.ok(sessions.some(s=>s.classId===created.at(-1).id));
});
