import { overviewCounts } from './validation.mjs';
import type { Data, Role } from './shared';

type Card = { title: string; value: number; note: string };

export default function LiveOverview({ data, role, go }: { data: Data; role: Role; go: (section: string) => void }) {
  const c = overviewCounts(data);
  const cards: Card[] = role === 'admin' ? [
    { title: 'Active students', value: c.activeStudents, note: c.inactiveStudents ? c.inactiveStudents + ' inactive' : 'No inactive students' },
    { title: 'Classes', value: c.classes, note: c.unassignedClasses ? c.unassignedClasses + ' without a teacher' : 'All have a teacher' },
    { title: 'Guardians to verify', value: c.pendingLinks, note: 'Teacher-added links waiting for you' },
    { title: 'Overdue payments', value: c.overdue, note: c.awaitingApproval + ' awaiting your approval' }]
    : role === 'finance' ? [
    { title: 'Awaiting check', value: c.awaitingCheck, note: 'Reported by teachers' },
    { title: 'Overdue', value: c.overdue, note: 'Not approved as paid after the period' },
    { title: 'Awaiting approval', value: c.awaitingApproval, note: 'Checked, waiting for an administrator' },
    { title: 'Parents', value: c.guardians, note: 'Recorded guardians' }]
    : [
    { title: 'My classes', value: c.classes, note: c.emptyClasses ? c.emptyClasses + ' with no students' : 'All have students' },
    { title: 'My students', value: c.activeStudents, note: 'Active students in my classes' },
    { title: 'Parents overdue', value: c.overdue, note: 'Payments overdue for my students’ parents' },
    { title: 'Awaiting finance', value: c.awaitingCheck, note: 'Payments I or others reported' }];
  const next: Array<[string, string]> = role === 'admin'
    ? [['Students', 'Add or edit a student'], ['Classes', 'Create a class or change its teacher'], ['Fees', 'Approve payments'], ['Guardians', 'Verify parents']]
    : role === 'finance' ? [['Fees', 'Check reported payments'], ['Guardians', 'Parent contacts']]
    : [['Attendance', 'Take attendance'], ['Fees', 'Report a parent payment'], ['Guardians', 'Add a parent contact']];
  return <section className="panel" aria-label="Overview">
    <span className="eyebrow">OVERVIEW</span><h2>Welcome back</h2>
    <div className="metric-grid">{cards.map(card => <div className="metric" key={card.title}>
      <div className="metric-value">{card.value}</div><div className="metric-title">{card.title}</div><div className="metric-subtitle">{card.note}</div></div>)}</div>
    {data.learners.length === 0 && data.classes.length === 0 && <p className="quiet">Nothing has been added yet. {role === 'admin' ? 'Start with a course, then a student and a class.' : 'Ask an administrator to add classes and students.'}</p>}
    <div className="quick-actions">{next.map(([section, text]) => <button key={section} className="small-btn" onClick={() => go(section)}>{text}</button>)}</div>
  </section>;
}
