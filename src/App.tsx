import { useState } from 'react';
import { paymentStatus } from './lib/finance.mjs';
import { summarizeDemoAcademy } from './lib/reporting.mjs';
import AcademyReports from './components/AcademyReports';
import { recordDemoPayment } from './lib/learning.mjs';
import { INITIAL_DEMO_ASSESSMENTS } from './lib/assessments.mjs';
import AcademyAssessments, { type AssessmentState } from './components/AcademyAssessments';
import AcademyFamily from './components/AcademyFamily';
import { INITIAL_DEMO_ACADEMICS } from './lib/academics.mjs';
import AcademyAcademics, { type AcademicState } from './components/AcademyAcademics';
import { INITIAL_DEMO_CLASSES } from './lib/operations.mjs';
import AcademyOperations, { type ClassRoom } from './components/AcademyOperations';

type Role = 'Student' | 'Teacher' | 'Administrator' | 'Guardian';
type Section = 'Overview' | 'Courses' | 'Classes' | 'Directory' | 'Timetable' | 'Lessons' | 'Assignments' | 'Quizzes' | 'Grades' | 'Attendance' | 'Finance' | 'Family' | 'Reports';
type Feature = { title: string; subtitle: string; icon: string; value: string };
const courses = [
  { title: 'Computer Foundations', topic: 'Hardware, files & basic troubleshooting', progress: 76, lessons: '9 of 12 lessons', icon: '◈' },
  { title: 'Creative Design', topic: 'Canva, layout & visual storytelling', progress: 45, lessons: '5 of 11 lessons', icon: '✳' },
  { title: 'Introduction to AI', topic: 'Prompt engineering & responsible AI', progress: 22, lessons: '2 of 9 lessons', icon: '✦' },
];
const sampleLedger = [
  { student: 'Student A', learnerId: 'learner-a', guardian: 'Guardian A', guardianId: 'guardian-a', due: 2500, recorded: 2500, period: 'October 2026' },
  { student: 'Student B', learnerId: 'learner-b', guardian: 'Guardian B', guardianId: 'guardian-b', due: 2500, recorded: 1000, period: 'October 2026' },
  { student: 'Student C', learnerId: 'learner-c', guardian: 'Guardian A', guardianId: 'guardian-a', due: 2500, recorded: 0, period: 'October 2026' },
];
const learners = [{id:'a',name:'Learner A'},{id:'b',name:'Learner B'},{id:'c',name:'Learner C'},{id:'d',name:'Learner D'}];
const exercises: Record<string,string>={'Computer Foundations':'Identify the CPU, RAM and SSD in a computer diagram.','Creative Design':'Design a poster with three colors and one clear headline.','Introduction to AI':'Improve a vague prompt by adding the role, task and audience.'};
const currency = (value: number) => 'ETB ' + value.toLocaleString('en-US');
const cardsByRole: Record<Role, Feature[]> = {
  Student: [
    { title: 'My courses', value: '03', subtitle: 'Active learning paths', icon: '▣' },
    { title: 'Assignments', value: '02', subtitle: 'Need your attention', icon: '◫' },
    { title: 'Attendance', value: '92%', subtitle: 'This term · sample', icon: '◷' },
    { title: 'Learning streak', value: '06', subtitle: 'Sessions completed', icon: '✳' },
  ],
  Teacher: [
    { title: 'My classes', value: '04', subtitle: 'Scheduled groups', icon: '▣' },
    { title: 'Students', value: '24', subtitle: 'Illustrative only', icon: '♧' },
    { title: 'To review', value: '07', subtitle: 'Sample submissions', icon: '◫' },
    { title: 'Attendance', value: '94%', subtitle: 'Illustrative only', icon: '◷' },
  ],
  Guardian: [],
  Administrator: [
    { title: 'Students', value: '—', subtitle: 'Distinct fictional learners', icon: '♧' },
    { title: 'Courses', value: '—', subtitle: 'Courses with groups', icon: '▣' },
    { title: 'Instructors', value: '—', subtitle: 'Assigned sample teachers', icon: '✳' },
    { title: 'Balances due', value: '—', subtitle: 'External payments only', icon: '◈' },
  ],
};
const nav: Section[] = ['Overview', 'Courses', 'Classes', 'Directory', 'Timetable', 'Lessons', 'Assignments', 'Quizzes', 'Grades', 'Attendance', 'Finance', 'Reports', 'Family'];
function App() {
  const [role, setRole] = useState<Role>('Student');
  const [classrooms,setClassrooms] = useState<ClassRoom[]>(() => structuredClone(INITIAL_DEMO_CLASSES));
  const [section, setSection] = useState<Section>('Overview');
  const [academic,setAcademic] = useState<AcademicState>(() => structuredClone(INITIAL_DEMO_ACADEMICS));
  const [assessments,setAssessments] = useState<AssessmentState>(() => structuredClone(INITIAL_DEMO_ASSESSMENTS) as unknown as AssessmentState);
  const [ledger,setLedger] = useState(sampleLedger);
  const [financeChanges,setFinanceChanges] = useState<Array<{sequence:number;previous:number;next:number;delta:number}>>([]);
  const [amount,setAmount] = useState('500');
  const [invoice,setInvoice] = useState(1);
  const [financeFeedback,setFinanceFeedback] = useState('');
  const [expandedCourse,setExpandedCourse] = useState<string|null>(null);
  const sections: Section[] = role === 'Guardian' ? ['Overview','Family']
    : role === 'Administrator' ? nav.filter(s=>s!=='Family')
    : nav.filter(s=>s!=='Family'&&s!=='Finance'&&s!=='Reports'&&(role==='Teacher'||s!=='Directory'));
  const adminMetrics=summarizeDemoAcademy({classes:classrooms,academic,assessments,ledger});
  function chooseRole(next: Role) { setRole(next); setSection('Overview'); }
  return <div className="shell">
    <aside className="sidebar">
      <div className="identity"><img className="brand-logo" src={`${import.meta.env.BASE_URL}bigchange-academy-logo.svg`} width="220" height="177" alt="BigChange Academy" /></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Dashboard sections">
        {sections.map((item, index) => <button key={item} className={section === item ? 'navitem active' : 'navitem'} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}><span className="navicon">{['▦','▤','▣','♧','◷','✎','☷','❖','▥','◷','◇','▥','♧'][nav.indexOf(item)]}</span>{item}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><strong>Build together, learn together.</strong><span>A better space for every learner.</span></div><div className="sidebar-note">Prototype · sample data only</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">BigChange Academy <span>/</span> {section}</div><div className="top-actions"><span className="prototype">● DEVELOPMENT PREVIEW</span><div className="avatar" aria-hidden="true">BC</div></div></header>
      <main className="content">
        <div className="heading"><div><div className="eyebrow">YOUR LEARNING COMMUNITY</div><h1>{section === 'Overview' ? (role==='Guardian' ? 'Welcome, Guardian A.' : 'Welcome to BigChange.') : section}</h1><p>{section === 'Overview' ? 'A home for curiosity, creativity, and progress.' : subtitle(section)}</p></div><label className="role-select">Preview role (not login) <select aria-label="Preview role (not authentication)" value={role} onChange={e => chooseRole(e.target.value as Role)}><option>Student</option><option>Teacher</option><option>Administrator</option><option>Guardian</option></select></label></div>
        <div role="note" className="notice"><strong>Demo environment</strong> — All names, balances and attendance are fictional. Interactions are temporary browser simulations and role-switching is not authentication. No real financial records or messages are stored or sent.</div>
        {section === 'Overview' && role !== 'Guardian' && <>
          <div className="metric-grid">{cardsByRole[role].map(c => <div className="metric" key={c.title}><span className="metric-icon">{c.icon}</span><div className="metric-value">{role==='Administrator'? (c.title==='Balances due'?currency(adminMetrics.fees.outstanding):c.title==='Students'?String(adminMetrics.summary.uniqueLearners):c.title==='Courses'?String(adminMetrics.summary.activeCourses):c.title==='Instructors'?String(adminMetrics.summary.activeTeachers):c.value) : c.value}</div><div className="metric-title">{c.title}</div><div className="metric-subtitle">{c.subtitle}</div></div>)}</div>
          <div className="two-col"><section className="panel"><div className="panel-head"><div><span className="eyebrow">KEEP EXPLORING</span><h2>Learning journeys</h2></div><button className="text-btn" onClick={() => setSection('Courses')}>View all courses →</button></div>{courses.map(course => <CourseRow course={course} key={course.title}/>)}</section><section className="panel calm"><span className="eyebrow">WHAT'S NEXT</span><h2>Make this week count.</h2><p>Practice makes progress. Check your assignments, celebrate milestones, and keep learning.</p><div className="next-steps"><span>◷</span><div><strong>Next class</strong><small>Computer Foundations · sample schedule</small></div></div><div className="next-steps"><span>✳</span><div><strong>Mini project</strong><small>Create your first digital poster</small></div></div><button className="primary-btn" onClick={() => setSection(role==='Administrator'?'Reports':'Assignments')}>{role==='Administrator'?'View academy reports →':'Explore assignments →'}</button></section></div>
        </>}
        {role==='Guardian'&&(section==='Overview'||section==='Family')&&
          <AcademyFamily key={section} view={section==='Family'?'family':'overview'} classes={classrooms}
            academic={academic} assessments={assessments} ledger={ledger} onOpenFamily={()=>setSection('Family')}/>}
        {section === 'Courses' && <section className="panel"><span className="eyebrow">SAMPLE LEARNING PATHS</span><h2>Explore your courses</h2>{courses.map(course => <div key={course.title}><CourseRow course={course}/><button className="small-btn lesson-button" aria-expanded={expandedCourse===course.title} onClick={()=>setExpandedCourse(expandedCourse===course.title?null:course.title)}>{expandedCourse===course.title?'Hide':'View'} practice activity</button>{expandedCourse===course.title && <div className="exercise"><strong>Mini challenge · {course.title}</strong><p>{exercises[course.title]}</p><small>Demonstration only. Nothing is saved.</small></div>}</div>)}</section>}
        {role!=='Guardian'&&(section==='Classes'||section==='Directory'||section==='Timetable') && <AcademyOperations key={role} role={role} view={section} classes={classrooms} onUpdate={setClassrooms}/>}
        {role!=='Guardian'&&(section === 'Assignments'||section === 'Quizzes'||section === 'Grades') && <AcademyAssessments
          key={role} view={section} role={role} classes={classrooms} terms={academic.terms}
          state={assessments} onUpdate={setAssessments}/>}
        {role!=='Guardian'&&(section === 'Attendance'||section === 'Lessons') && <AcademyAcademics key={role} view={section} role={role} classes={classrooms} academic={academic} onUpdate={setAcademic}/>}
        {section==='Reports'&&role==='Administrator'&&<AcademyReports classes={classrooms} academic={academic}
          assessments={assessments} ledger={ledger} financeChanges={financeChanges}/>}
        {section === 'Finance' && role === 'Administrator' && <section className="panel"><div className="panel-head"><div><span className="eyebrow">ADMIN LEDGER · FICTIONAL AMOUNTS ONLY</span><h2>External payment tracking</h2><p>Simulate recording money received outside this Hub. No payment processing or parent messages.</p></div></div><div className="finance-strip"><div><small>Expected</small><strong>{currency(ledger.reduce((s,x)=>s+x.due,0))}</strong></div><div><small>Recorded</small><strong>{currency(ledger.reduce((s,x)=>s+x.recorded,0))}</strong></div><div><small>Outstanding</small><strong>{currency(ledger.reduce((s,x)=>s+outstandingBalance(x.due-x.recorded),0))}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian</th><th>Period</th><th>Due</th><th>Recorded</th><th>Status</th></tr></thead><tbody>{ledger.map(row=><tr key={row.student}><td>{row.student}</td><td>{row.guardian}</td><td>{row.period}</td><td>{currency(row.due)}</td><td>{currency(row.recorded)}</td><td><span className={'tag '+(paymentStatus(row.due,row.recorded)==='Paid'?'green':'amber')}>{paymentStatus(row.due,row.recorded)}</span></td></tr>)}</tbody></table></div><form className="demo-form" onSubmit={event=>{event.preventDefault();const row=ledger[invoice];try{const n=recordDemoPayment(row.due,row.recorded,Number(amount));setLedger(all=>all.map((item,i)=>i===invoice?{...item,recorded:n}:item));setFinanceChanges(history=>[...history,{sequence:history.length+1,previous:row.recorded,next:n,delta:Number(amount)}]);setFinanceFeedback('Updated fictional ledger for '+row.student+'. No actual payment.');setAmount('');}catch(error){setFinanceFeedback(error instanceof Error?error.message:'Invalid amount');}}}><h3>Record a demo payment</h3><label>Sample invoice<select value={invoice} onChange={e=>{setInvoice(Number(e.target.value));setFinanceFeedback('');}}>{ledger.map((item,i)=><option key={item.student} value={i}>{item.student} · {currency(Math.max(0,item.due-item.recorded))} remaining</option>)}</select></label><label>ETB amount<input type="number" min="1" step="1" placeholder="500" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="primary-btn" type="submit">Record sample only</button><p className="form-feedback" role="status" aria-live="polite">{financeFeedback}</p></form><p className="quiet">No email or WhatsApp is sent. Verified contacts and authorization must come first.</p></section>}
        
        <footer>BigChange Academy Hub · Original independent prototype · Never enter real student data here</footer>
      </main>
    </div>
  </div>;
}
function subtitle(section: Section) {
  switch(section) {
    case 'Courses': return 'Explore structured learning at your own pace.';
    case 'Classes': return 'Organize fictional groups, instructors and class rosters.';
    case 'Directory': return 'Browse illustrative instructors and learner enrollments.';
    case 'Timetable': return 'Follow two weekly sample class sessions.';
    case 'Lessons': return 'Plan class sessions and learning goals within three-month terms.';
    case 'Assignments': return 'Projects, rubrics and sample teacher feedback for each class.';
    case 'Quizzes': return 'Practice multiple-choice questions by classroom.';
    case 'Grades': return 'See fictional feedback, scores and class progress.';
    case 'Attendance': return 'Celebrate the sessions that move us forward.';
    case 'Finance': return 'A clear view of payments received outside the system.';
    case 'Family': return 'Follow fictional children’s coursework, attendance and fee summaries.';
    case 'Reports': return 'Review fictional student occupancy, teacher allocations, attendance and external-fee reconciliation.';
    default: return '';
  }
}
function CourseRow({course}:{course:{title:string;topic:string;progress:number;lessons:string;icon:string}}) {
  return <div className="course-row"><div className="course-icon">{course.icon}</div><div className="course-main"><strong>{course.title}</strong><small>{course.topic}</small><div className="progress"><span style={{width:course.progress+'%'}} /></div></div><div className="course-stat"><strong>{course.progress}%</strong><small>{course.lessons}</small></div></div>;
}
export default App;
