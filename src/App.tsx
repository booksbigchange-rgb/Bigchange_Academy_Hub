import { useState } from 'react';
import { outstandingBalance, paymentStatus } from './lib/finance.mjs';
import {demoOverviewCards,demoSidebarSections,demoVisibleCourses,demoOverviewHighlight} from './lib/dashboard.mjs';
import AcademyReports from './components/AcademyReports';
import AcademyCourseCatalog,{type CourseRecord} from './components/AcademyCourseCatalog';
import {initialDemoCourses} from './lib/course-catalog.mjs';
import AcademyFeePlan from './components/AcademyFeePlan';
import AcademyPaymentRecorder from './components/AcademyPaymentRecorder';
import { INITIAL_DEMO_ASSESSMENTS } from './lib/assessments.mjs';
import AcademyAssessments, { type AssessmentState } from './components/AcademyAssessments';
import AcademyFamily from './components/AcademyFamily';
import AcademyGuardianAdmin,{type Guardian} from './components/AcademyGuardianAdmin';
import {initialDemoGuardians} from './lib/guardian-admin.mjs';
import { INITIAL_DEMO_ACADEMICS } from './lib/academics.mjs';
import AcademyAcademics, { type AcademicState } from './components/AcademyAcademics';
import { INITIAL_DEMO_CLASSES, DEMO_TEACHERS, DEMO_LEARNERS,activeDemoPeople } from './lib/operations.mjs';
import AcademyOperations, { type ClassRoom, type Person } from './components/AcademyOperations';

type Role = 'Student' | 'Teacher' | 'Administrator' | 'Guardian';
type Section = 'Overview' | 'Courses' | 'Classes' | 'Directory' | 'Timetable' | 'Lessons' | 'Assignments' | 'Quizzes' | 'Grades' | 'Attendance' | 'Finance' | 'Family' | 'Reports' | 'Guardians';
const sampleLedger = [
  { student: 'Student A', learnerId: 'learner-a', guardian: 'Guardian A', guardianId: 'guardian-a', due: 2500, recorded: 2500, period: 'October 2026' },
  { student: 'Student B', learnerId: 'learner-b', guardian: 'Guardian B', guardianId: 'guardian-b', due: 2500, recorded: 1000, period: 'October 2026' },
  { student: 'Student C', learnerId: 'learner-c', guardian: 'Guardian A', guardianId: 'guardian-a', due: 2500, recorded: 0, period: 'October 2026' },
];
const currency = (value: number) => 'ETB ' + value.toLocaleString('en-US');
const navIcons: Record<Section,string> = {Overview:'▦',Courses:'▤',Classes:'▣',Directory:'♧',Timetable:'◷',Lessons:'✎',Assignments:'☷',Quizzes:'❖',Grades:'▥',Attendance:'◷',Finance:'◇',Reports:'▥',Family:'♧',Guardians:'♧'};
function App() {
  const [role, setRole] = useState<Role>('Student');
  const [classrooms,setClassrooms] = useState<ClassRoom[]>(() => structuredClone(INITIAL_DEMO_CLASSES));
  const [courses,setCourses] = useState<CourseRecord[]>(() => initialDemoCourses() as CourseRecord[]);
  const [teachers,setTeachers] = useState<Person[]>(() => DEMO_TEACHERS.map(t=>({...t})));
  const [students,setStudents] = useState<Person[]>(() => DEMO_LEARNERS.map(s=>({...s})));
  const [guardians,setGuardians] = useState<Guardian[]>(initialDemoGuardians);
  const [previewGuardianId,setPreviewGuardianId] = useState('guardian-a');
  const [previewTeacherId,setPreviewTeacherId]=useState('teacher-a');
  const [previewLearnerId,setPreviewLearnerId]=useState('learner-a');
  const [section, setSection] = useState<Section>('Overview');
  const [peopleFocus,setPeopleFocus] = useState<'teacher'|'student'|null>(null);
  const [academic,setAcademic] = useState<AcademicState>(() => structuredClone(INITIAL_DEMO_ACADEMICS));
  const [assessments,setAssessments] = useState<AssessmentState>(() => structuredClone(INITIAL_DEMO_ASSESSMENTS) as unknown as AssessmentState);
  const [ledger,setLedger] = useState(sampleLedger);
  const [financeChanges,setFinanceChanges] = useState<Array<{sequence:number;previous:number;next:number;delta:number;kind?:'payment'|'adjustment';student?:string;period?:string;receiptNo?:string;previousPeriod?:string}>>([]);
  const [amount,setAmount] = useState('500');
  const [invoice,setInvoice] = useState(1);
  const [financeFeedback,setFinanceFeedback] = useState('');
  const [expandedCourse,setExpandedCourse] = useState<string|null>(null);
  const activeTeachers=activeDemoPeople(teachers) as Person[];
  const activeLearners=activeDemoPeople(students) as Person[];
  const activeGuardians=guardians.filter(g=>g.active!==false);
  const guardianId=activeGuardians.some(g=>g.id===previewGuardianId)?previewGuardianId:'guardian-a';
  const teacherId=activeTeachers.some(p=>p.id===previewTeacherId)?previewTeacherId:'teacher-a';
  const learnerId=activeLearners.some(p=>p.id===previewLearnerId)?previewLearnerId:'learner-a';
  const identity={teacherId,learnerId};
  const sections = demoSidebarSections(role) as Section[];
  const cards = demoOverviewCards(role,{classes:classrooms,academic,assessments,ledger,teachers:activeTeachers,students:activeLearners,courses,...identity});
  const visibleCourses = demoVisibleCourses(role,classrooms,identity,courses);
  const classHighlight = demoOverviewHighlight(role,classrooms,identity,courses);
  function chooseRole(next: Role) { setRole(next); setPeopleFocus(null); setSection('Overview'); }
  function openPeopleForm(kind:'teacher'|'student'){setPeopleFocus(kind);setSection('Directory');}
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar">
      <div className="identity"><img className="brand-logo" src={`${import.meta.env.BASE_URL}bigchange-academy-logo.svg`} width="220" height="177" alt="BigChange Academy" /></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Dashboard sections">
        {sections.map(item => <button key={item} className={section === item ? 'navitem active' : 'navitem'} aria-current={section === item ? 'page' : undefined} onClick={() => {setPeopleFocus(null);setSection(item);}}><span className="navicon" aria-hidden="true">{navIcons[item]}</span>{item==='Directory'?'People & Roles':item}</button>)}
      </nav>
      <p className="nav-scroll-hint">On small screens, scroll the section menu sideways to see more options.</p>
      <div className="sidebar-bottom"><div className="sidebar-help"><strong>Build together, learn together.</strong><span>A better space for every learner.</span></div><div className="sidebar-note">Prototype · sample data only</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><nav className="crumb" aria-label="Breadcrumb">BigChange Academy <span aria-hidden="true">/</span> <span aria-current="page">{section}</span></nav><div className="top-actions"><span className="prototype">● DEVELOPMENT PREVIEW</span><div className="avatar" aria-hidden="true">BC</div></div></header>
      <main className="content" id="main-content" tabIndex={-1}>
        <div className="heading"><div><div className="eyebrow">YOUR LEARNING COMMUNITY</div><h1>{section === 'Overview' ? (role==='Guardian' ? 'Welcome to the family space.' : 'Welcome to BigChange.') : section}</h1><p>{section === 'Overview' ? 'A home for curiosity, creativity, and progress.' : subtitle(section)}</p></div><label className="role-select">Preview role (not login) <select aria-label="Preview role (not authentication)" value={role} onChange={e => chooseRole(e.target.value as Role)}><option>Student</option><option>Teacher</option><option>Administrator</option><option>Guardian</option></select></label>
        {role==='Guardian'&&<label className="role-select">Fictional guardian identity (not login)
          <select aria-label="Selected fictional guardian preview" value={guardianId} onChange={e=>setPreviewGuardianId(e.target.value)}>
            {activeGuardians.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>}
        {(role==='Teacher'||role==='Student')&&<label className="role-select">Fictional {role.toLowerCase()} identity (not login)
          <select aria-label="Selected fictional preview identity" value={role==='Teacher'?teacherId:learnerId}
            onChange={e=>{if(role==='Teacher')setPreviewTeacherId(e.target.value);else setPreviewLearnerId(e.target.value);}}>
            {(role==='Teacher'?activeTeachers:activeLearners).map(person=>
              <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>}</div>
        <div role="note" className="notice"><strong>Demo environment</strong> — All names, balances and attendance are fictional. Interactions are temporary browser simulations and role-switching is not authentication. No real financial records or messages are stored or sent.</div>
        {section === 'Overview' && role==='Administrator' && <div className="quick-actions">
          <button className="primary-btn" type="button" onClick={()=>openPeopleForm('teacher')}>+ Add Teacher</button>
          <button className="small-btn" type="button" onClick={()=>openPeopleForm('student')}>+ Add Student</button>
          <button className="small-btn" type="button" onClick={()=>setSection('Guardians')}>+ Add Guardian</button>
          <span className="quiet">Manage fictional staff, learners and guardians.</span>
        </div>}
        {section === 'Overview' && role !== 'Guardian' && <>
          <div className="metric-grid">{cards.map(c => <div className="metric" key={c.title}><span className="metric-icon">{c.icon}</span><div className="metric-value">{c.value}</div><div className="metric-title">{c.title}</div><div className="metric-subtitle">{c.subtitle}</div></div>)}</div>
          <div className="two-col"><section className="panel"><div className="panel-head"><div><span className="eyebrow">KEEP EXPLORING</span><h2>Learning journeys</h2></div><button className="text-btn" onClick={() => setSection('Courses')}>View all courses →</button></div>{visibleCourses.slice(0,3).map(course => <CourseRow course={course} key={course.id}/>)}</section><section className="panel calm"><span className="eyebrow">WHAT'S NEXT</span><h2>Make this week count.</h2><p>Practice makes progress. Check your assignments, celebrate milestones, and keep learning.</p><div className="next-steps"><span>◷</span><div><strong>{classHighlight.label}</strong><small>{classHighlight.subject} · {classHighlight.schedule}</small></div></div><div className="next-steps"><span>✳</span><div><strong>Sample practice activity</strong><small>{classHighlight.practice}</small></div></div><button className="primary-btn" onClick={() => setSection(role==='Administrator'?'Reports':'Assignments')}>{role==='Administrator'?'View academy reports →':'Explore assignments →'}</button></section></div>
        </>}
        {role==='Guardian'&&(section==='Overview'||section==='Family')&&
          <AcademyFamily key={guardianId} view={section==='Family'?'family':'overview'} classes={classrooms}
            academic={academic} assessments={assessments} ledger={ledger} learners={students} courses={courses} guardianId={guardianId} guardians={guardians} onOpenFamily={()=>setSection('Family')}/>}
        {section==='Courses'&&role==='Administrator'&&<AcademyCourseCatalog courses={courses} classes={classrooms} onChange={setCourses}/>}
        {section==='Courses'&&role!=='Administrator'&&<section className="panel"><span className="eyebrow">FICTIONAL CLASSROOM COURSE CATALOG</span><h2>Courses assigned in my sample groups</h2><p>These examples are derived from the current group roster, not measured course completion.</p>{visibleCourses.map(course=><div key={course.id}><CourseRow course={course}/><button className="small-btn lesson-button" aria-expanded={expandedCourse===course.id} onClick={()=>setExpandedCourse(expandedCourse===course.id?null:course.id)}>{expandedCourse===course.id?'Hide':'View'} practice activity</button>{expandedCourse===course.id&&<div className="exercise"><strong>Mini challenge · {course.title}</strong><p>{course.activity}</p><small>Demonstration only. Nothing is saved.</small></div>}</div>)}{visibleCourses.length===0&&<p className="quiet">No course groups are assigned in this fictional role yet.</p>}</section>}
        {role!=='Guardian'&&(section==='Classes'||section==='Directory'||section==='Timetable') && <AcademyOperations key={role+'-'+(role==='Teacher'?teacherId:learnerId)} role={role} view={section} classes={classrooms} courses={courses} sessions={academic.sessions} onUpdate={setClassrooms}
          teachers={teachers} learners={students} guardians={guardians} focusPerson={peopleFocus} onTeachers={setTeachers} onLearners={setStudents} teacherId={teacherId} learnerId={learnerId}/>}
        {role!=='Guardian'&&(section === 'Assignments'||section === 'Quizzes'||section === 'Grades') && <AcademyAssessments
          key={role+'-'+(role==='Teacher'?teacherId:learnerId)} view={section} role={role} classes={classrooms} courses={courses} learners={students} terms={academic.terms}
          state={assessments} onUpdate={setAssessments} teacherId={teacherId} learnerId={learnerId}/>}
        {role!=='Guardian'&&(section === 'Attendance'||section === 'Lessons') && <AcademyAcademics key={role+'-'+(role==='Teacher'?teacherId:learnerId)} view={section} role={role} classes={classrooms} courses={courses} learners={students} academic={academic} onUpdate={setAcademic} teacherId={teacherId} learnerId={learnerId}/>}
        {section==='Guardians'&&role==='Administrator'&&<AcademyGuardianAdmin guardians={guardians} learners={students} onChange={setGuardians}/>}
        {section==='Reports'&&role==='Administrator'&&<AcademyReports classes={classrooms} courses={courses} academic={academic}
          assessments={assessments} ledger={ledger} teachers={activeTeachers} financeChanges={financeChanges}/>}
        {section==='Finance'&&role==='Administrator'&&<AcademyFeePlan
          learners={students} guardians={guardians} ledger={ledger}
          onUpdate={setLedger} onCreated={setInvoice} onAdjustment={entry=>setFinanceChanges(history=>[...history,{...entry,sequence:history.length+1}])}/>}
        {section === 'Finance' && role === 'Administrator' && <section className="panel"><div className="panel-head"><div><span className="eyebrow">ADMIN LEDGER · FICTIONAL AMOUNTS ONLY</span><h2>External payment tracking</h2><p>Simulate recording money received outside this Hub. No payment processing or parent messages.</p></div></div><div className="finance-strip"><div><small>Expected</small><strong>{currency(ledger.reduce((s,x)=>s+x.due,0))}</strong></div><div><small>Recorded</small><strong>{currency(ledger.reduce((s,x)=>s+x.recorded,0))}</strong></div><div><small>Outstanding</small><strong>{currency(ledger.reduce((s,x)=>s+outstandingBalance(x.due-x.recorded),0))}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian</th><th>Period</th><th>Due</th><th>Recorded</th><th>Status</th></tr></thead><tbody>{ledger.map(row=><tr key={row.learnerId+'-'+row.period}><td>{row.student}</td><td>{row.guardian}</td><td>{row.period}</td><td>{currency(row.due)}</td><td>{currency(row.recorded)}</td><td><span className={'tag '+(paymentStatus(row.due,row.recorded)==='Paid'?'green':'amber')}>{paymentStatus(row.due,row.recorded)}</span></td></tr>)}</tbody></table></div><AcademyPaymentRecorder ledger={ledger} invoice={invoice} onInvoiceChange={setInvoice}
          amount={amount} onAmountChange={setAmount} feedback={financeFeedback} onFeedbackChange={setFinanceFeedback}
          nextSequence={financeChanges.length+1} onUpdate={setLedger}
          onPayment={entry=>setFinanceChanges(history=>[...history,{...entry,sequence:history.length+1}])}/><p className="quiet">No email or WhatsApp is sent. Verified contacts and authorization must come first.</p></section>}
        
        <footer>BigChange Academy Hub · Original independent prototype · Never enter real student data here</footer>
      </main>
    </div>
  </div>;
}
function subtitle(section: Section) {
  switch(section) {
    case 'Courses': return 'Explore structured learning at your own pace.';
    case 'Classes': return 'Organize fictional groups, instructors and class rosters.';
    case 'Directory': return 'Add fictional teachers and students, then enroll them in classes.';
    case 'Timetable': return 'Follow two weekly sample class sessions.';
    case 'Lessons': return 'Plan class sessions and learning goals within three-month terms.';
    case 'Assignments': return 'Projects, rubrics and sample teacher feedback for each class.';
    case 'Quizzes': return 'Practice multiple-choice questions by classroom.';
    case 'Grades': return 'See fictional feedback, scores and class progress.';
    case 'Attendance': return 'Celebrate the sessions that move us forward.';
    case 'Finance': return 'A clear view of payments received outside the system.';
    case 'Guardians': return 'Manage fictional family profiles and synthetic child relationships.';
    case 'Family': return 'Follow fictional children’s coursework, attendance and fee summaries.';
    case 'Reports': return 'Review fictional student occupancy, teacher allocations, attendance and external-fee reconciliation.';
    default: return '';
  }
}
type DemoCourseCard={id:string;title:string;topic:string;icon:string;courseStat:string;statNote:string;activity:string;groupCount:number};
function CourseRow({course}:{course:DemoCourseCard}) {
  return <div className="course-row"><div className="course-icon">{course.icon}</div>
    <div className="course-main"><strong>{course.title}</strong><small>{course.topic}</small></div>
    <div className="course-stat"><strong>{course.courseStat}</strong><small>{course.statNote}</small></div>
  </div>;
}
export default App;
