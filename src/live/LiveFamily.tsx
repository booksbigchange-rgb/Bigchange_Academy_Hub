import { useState } from 'react';
import { attendanceSummary, localDay } from './validation.mjs';
import { STAGE_LABEL, STATUS_LABEL, formatDate, usd } from './fees.mjs';
import type { Data, Role } from './shared';

const tagClass = (s: string) => 'tag ' + (s === 'paid' ? 'green' : s === 'overdue' ? 'red' : 'amber');
const MARK: Record<string, string> = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };

/** Read-only view for a signed-in parent (their verified children) or student (themself). The database decides what is visible. */
export default function LiveFamily({ data, role }: { data: Data; role: Role }) {
  const [childId, setChildId] = useState('');
  const children = data.learners;
  const child = children.find(l => l.id === childId) ?? children[0];
  if (!child) return <section className="panel"><h2>{role === 'guardian' ? 'No children linked yet' : 'No student record'}</h2>
    <p className="quiet">{role === 'guardian' ? 'The school must verify the link to your child before anything appears here. Please contact the school office.' : 'Your account has no student record yet.'}</p></section>;
  const classIds = data.enrollments.filter(e => e.learner_id === child.id).map(e => e.class_id);
  const classes = data.classes.filter(c => classIds.includes(c.id));
  const course = (id: string) => data.courses.find(c => c.id === id)?.title ?? '';
  const marks = data.attendance.filter(a => a.learner_id === child.id);
  const sum = attendanceSummary(marks);
  const recent = marks.map(a => ({ a, s: data.sessions.find(s => s.id === a.session_id) })).filter(x => x.s)
    .sort((x, y) => (y.s!.starts_at > x.s!.starts_at ? 1 : -1)).slice(0, 8);
  return <section className="panel operations" aria-label="My children">
    <span className="eyebrow">{role === 'guardian' ? 'MY CHILDREN' : 'MY CLASSES'}</span><h2>{child.display_name}</h2>
    {children.length > 1 && <label>Child<select value={child.id} onChange={e => setChildId(e.target.value)}>
      {children.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}</select></label>}
    <h3>Classes</h3>
    {classes.length === 0 ? <p className="quiet">Not enrolled in a class yet.</p> :
      <ul>{classes.map(c => <li key={c.id}>{c.title} — {course(c.course_id)}</li>)}</ul>}
    <h3>Attendance</h3>
    {marks.length === 0 ? <p className="quiet">No attendance recorded yet.</p> : <>
      <p>Present {sum.present} · Late {sum.late} · Absent {sum.absent} · Excused {sum.excused}{sum.rate !== null && <> · Attendance rate <strong>{sum.rate}%</strong></>}</p>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Class</th><th>Mark</th></tr></thead><tbody>
        {recent.map(({ a, s }) => <tr key={a.session_id}><td>{formatDate(localDay(s!.starts_at))}</td>
          <td>{data.classes.find(c => c.id === s!.class_id)?.title ?? '—'}</td><td>{MARK[a.status]}</td></tr>)}</tbody></table></div></>}
  </section>;
}

export function LivePayments({ data }: { data: Data }) {
  return <section className="panel operations" aria-label="Payments">
    <span className="eyebrow">PAYMENTS · TRACKING ONLY</span><h2>My payments</h2>
    <p className="quiet">Payments are made directly to the school, not through this app. This page shows what the school has recorded and approved.</p>
    {data.periods.length === 0 ? <p className="quiet">No payment period has been started for you yet.</p> :
      <div className="table-wrap"><table><thead><tr><th>Period</th><th>Courses</th><th>Fee</th><th>Paid on</th><th>Status</th></tr></thead><tbody>
        {data.periods.map(p => <tr key={p.id}><td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td><td>{p.course_count}</td><td>{usd(p.amount_due)}</td>
          <td>{formatDate(p.paid_on ?? '')}</td><td><span className={tagClass(p.status)}>{STATUS_LABEL[p.status]}</span><br /><small>{STAGE_LABEL[p.stage]}</small></td></tr>)}</tbody></table></div>}
  </section>;
}
