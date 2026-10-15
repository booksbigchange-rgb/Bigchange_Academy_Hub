import { useState } from 'react';
import { outstandingBalance, paymentStatus } from './lib/finance.mjs';

type Role = 'Student' | 'Teacher' | 'Administrator';
type Section = 'Overview' | 'Courses' | 'Assignments' | 'Attendance' | 'Finance';
type Feature = { title: string; subtitle: string; icon: string; value: string };
const courses = [
  { title: 'Computer Foundations', topic: 'Hardware, files & basic troubleshooting', progress: 76, lessons: '9 of 12 lessons', icon: '◈' },
  { title: 'Creative Design', topic: 'Canva, layout & visual storytelling', progress: 45, lessons: '5 of 11 lessons', icon: '✳' },
  { title: 'Introduction to AI', topic: 'Prompt engineering & responsible AI', progress: 22, lessons: '2 of 9 lessons', icon: '✦' },
];
const sampleLedger = [
  { student: 'Student A', guardian: 'Guardian A', due: 2500, recorded: 2500, period: 'October 2026' },
  { student: 'Student B', guardian: 'Guardian B', due: 2500, recorded: 1000, period: 'October 2026' },
  { student: 'Student C', guardian: 'Guardian C', due: 2500, recorded: 0, period: 'October 2026' },
];
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
  Administrator: [
    { title: 'Students', value: '48', subtitle: 'Sample enrollment', icon: '♧' },
    { title: 'Courses', value: '08', subtitle: 'Catalog examples', icon: '▣' },
    { title: 'Instructors', value: '05', subtitle: 'Sample staff count', icon: '✳' },
    { title: 'Balances due', value: currency(4000), subtitle: 'From sample ledger', icon: '◈' },
  ],
};
const nav: Section[] = ['Overview', 'Courses', 'Assignments', 'Attendance', 'Finance'];
function App() {
  const [role, setRole] = useState<Role>('Student');
  const [section, setSection] = useState<Section>('Overview');
  const sections = role === 'Administrator' ? nav : nav.filter(s => s !== 'Finance');
  function chooseRole(next: Role) { setRole(next); setSection('Overview'); }
  return <div className="shell">
    <aside className="sidebar">
      <div className="identity"><span className="mark">B<span>✦</span></span><div><strong>BigChange</strong><small>ACADEMY HUB</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Dashboard sections">
        {sections.map((item, index) => <button key={item} className={section === item ? 'navitem active' : 'navitem'} onClick={() => setSection(item)}><span className="navicon">{['▦','▤','☷','◷','◇'][nav.indexOf(item)]}</span>{item}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><strong>Build together, learn together.</strong><span>A better space for every learner.</span></div><div className="sidebar-note">Prototype · sample data only</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">BigChange Academy <span>/</span> {section}</div><div className="top-actions"><span className="prototype">● DEVELOPMENT PREVIEW</span><div className="avatar" aria-hidden="true">BC</div></div></header>
      <main className="content">
        <div className="heading"><div><div className="eyebrow">YOUR LEARNING COMMUNITY</div><h1>{section === 'Overview' ? `Welcome to BigChange.` : section}</h1><p>{section === 'Overview' ? 'A home for curiosity, creativity, and progress.' : subtitle(section)}</p></div><label className="role-select">Preview as <select aria-label="Preview role (not authentication)" value={role} onChange={e => chooseRole(e.target.value as Role)}><option>Student</option><option>Teacher</option><option>Administrator</option></select></label></div>
        <div role="note" className="notice"><strong>Demo environment</strong> — All names, balances, grades and attendance are fictional. Switching roles here is a UI demonstration, not secure authentication.</div>
        {section === 'Overview' && <>
          <div className="metric-grid">{cardsByRole[role].map(c => <div className="metric" key={c.title}><span className="metric-icon">{c.icon}</span><div className="metric-value">{c.value}</div><div className="metric-title">{c.title}</div><div className="metric-subtitle">{c.subtitle}</div></div>)}</div>
          <div className="two-col"><section className="panel"><div className="panel-head"><div><span className="eyebrow">KEEP EXPLORING</span><h2>Learning journeys</h2></div><button className="text-btn" onClick={() => setSection('Courses')}>View all courses →</button></div>{courses.map(course => <CourseRow course={course} key={course.title}/>)}</section><section className="panel calm"><span className="eyebrow">WHAT'S NEXT</span><h2>Make this week count.</h2><p>Practice makes progress. Check your assignments, celebrate milestones, and keep learning.</p><div className="next-steps"><span>◷</span><div><strong>Next class</strong><small>Computer Foundations · sample schedule</small></div></div><div className="next-steps"><span>✳</span><div><strong>Mini project</strong><small>Create your first digital poster</small></div></div><button className="primary-btn" onClick={() => setSection('Assignments')}>Explore assignments →</button></section></div>
        </>}
        {section === 'Courses' && <section className="panel"><div className="panel-head"><div><span className="eyebrow">CURRICULUM</span><h2>Explore your courses</h2></div></div>{courses.map(course => <CourseRow course={course} key={course.title}/>)}</section>}
        {section === 'Assignments' && <section className="panel"><span className="eyebrow">DEMONSTRATION</span><h2>Assignments</h2><div className="assignment"><span className="assignment-icon">✎</span><div><strong>Design a digital poster</strong><small>Creative Design · illustrative task</small></div><span className="tag amber">Not submitted</span></div><div className="assignment"><span className="assignment-icon">◈</span><div><strong>Identify the parts of a computer</strong><small>Computer Foundations · illustrative task</small></div><span className="tag">Practice</span></div><p className="quiet">Submitting and grading assignments will be implemented after login and data isolation are built.</p></section>}
        {section === 'Attendance' && <section className="panel"><span className="eyebrow">CLASS PARTICIPATION</span><h2>Attendance</h2><p>Twice-weekly class attendance is planned. Records shown in this prototype are not real.</p><div className="attendance"><span>MON</span><strong>Session sample A</strong><span className="tag green">Present</span></div><div className="attendance"><span>THU</span><strong>Session sample B</strong><span className="tag green">Present</span></div></section>}
        {section === 'Finance' && role === 'Administrator' && <section className="panel"><div className="panel-head"><div><span className="eyebrow">ADMINISTRATIVE LEDGER · SAMPLE ONLY</span><h2>External payment tracking</h2><p>Record payments received outside the Hub. No checkout, card collection or messaging is connected.</p></div></div><div className="finance-strip"><div><small>Expected</small><strong>{currency(sampleLedger.reduce((s, x) => s + x.due, 0))}</strong></div><div><small>Recorded paid</small><strong>{currency(sampleLedger.reduce((s, x) => s + x.recorded, 0))}</strong></div><div><small>Outstanding</small><strong>{currency(sampleLedger.reduce((s, x) => s + outstandingBalance(x.due - x.recorded), 0))}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian</th><th>Billing period</th><th>Due</th><th>Recorded</th><th>Status</th></tr></thead><tbody>{sampleLedger.map(row => <tr key={row.student}><td>{row.student}</td><td>{row.guardian}</td><td>{row.period}</td><td>{currency(row.due)}</td><td>{currency(row.recorded)}</td><td><span className={'tag ' + (paymentStatus(row.due,row.recorded) === 'Paid' ? 'green' : 'amber')}>{paymentStatus(row.due,row.recorded)}</span></td></tr>)}</tbody></table></div><p className="quiet">Email/WhatsApp notification drafts are planned for a later phase and will require approved guardian contacts, opt-in, and server-side delivery controls.</p></section>}
        <footer>BigChange Academy Hub · Original independent prototype · Never enter real student data here</footer>
      </main>
    </div>
  </div>;
}
function subtitle(section: Section) {
  switch(section) {
    case 'Courses': return 'Explore structured learning at your own pace.';
    case 'Assignments': return 'Small challenges, big steps forward.';
    case 'Attendance': return 'Celebrate the sessions that move us forward.';
    case 'Finance': return 'A clear view of payments received outside the system.';
    default: return '';
  }
}
function CourseRow({course}:{course:{title:string;topic:string;progress:number;lessons:string;icon:string}}) {
  return <div className="course-row"><div className="course-icon">{course.icon}</div><div className="course-main"><strong>{course.title}</strong><small>{course.topic}</small><div className="progress"><span style={{width:course.progress+'%'}} /></div></div><div className="course-stat"><strong>{course.progress}%</strong><small>{course.lessons}</small></div></div>;
}
export default App;
