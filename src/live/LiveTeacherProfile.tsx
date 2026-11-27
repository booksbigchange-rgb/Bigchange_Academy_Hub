import { dataForTeacher, teacherStats } from './dashboard.mjs';
import { daysUntil, endingText, formatDate, todayIso } from './fees.mjs';
import { HeatCalendar } from './LiveOverview';
import type { StaffMember } from './api';
import type { Data } from './shared';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', teacher: 'Teacher', finance: 'Finance' };
type Stats = {
  classes: Array<{ id: string; title: string; course: string; students: number; rate: number | null; levelEnd: string | null }>;
  students: number; lessonsThisMonth: number; rate: number | null;
  monthly: Array<{ month: string; label: string; count: number }>;
  missing: Array<{ sessionId: string; date: string; classTitle: string; marked: number; enrolled: number }>;
};

/** Admin: one staff member at a glance: classes, students, lessons per month, attendance, and lessons with attendance not completed. */
export default function LiveTeacherProfile({ member, data, onClose, self = false }: { member: StaffMember; data: Data; onClose?: () => void; self?: boolean }) {
  const today = todayIso();
  const s: Stats = teacherStats(data, member.staff_id as string);
  const max = Math.max(1, ...s.monthly.map(m => m.count));
  const name = member.display_name ?? member.email;
  const initials = name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return <section className="profile" aria-label={'Profile of ' + name}>
    <div className="profile-head">
      <div className="profile-avatar" aria-hidden="true">{initials}</div>
      <div className="profile-id">
        <h3>{name}</h3>
        <div className="profile-meta">
          <span className="tag amber">{ROLE_LABEL[member.role ?? ''] ?? 'No role'}</span>
          <span className={'tag ' + (member.active ? 'green' : 'red')}>{member.active ? 'Access on' : 'Access off'}</span>
          <span>{member.email}</span>
          {!self && <span>Last signed in: {member.last_sign_in_at ? formatDate(member.last_sign_in_at) : 'never'}</span>}
        </div>
      </div>
      {onClose && <button className="small-btn" type="button" onClick={onClose}>Close profile</button>}
    </div>

    <div className="metric-grid profile-cards">
      <div className="metric metric-hero"><div className="metric-value">{s.classes.length}</div><div className="metric-title">Classes</div><div className="metric-subtitle">{s.classes.length ? 'taught now' : 'No class assigned'}</div></div>
      <div className="metric"><div className="metric-value">{s.students}</div><div className="metric-title">Students</div><div className="metric-subtitle">active, in their classes</div></div>
      <div className="metric"><div className="metric-value">{s.lessonsThisMonth}</div><div className="metric-title">Lessons this month</div><div className="metric-subtitle">held in their classes</div></div>
      <div className="metric"><div className="metric-value">{s.rate === null ? '—' : s.rate + '%'}</div><div className="metric-title">Attendance (4 weeks)</div><div className="metric-subtitle">{s.missing.length ? `${s.missing.length} lesson${s.missing.length === 1 ? '' : 's'} not fully marked` : 'All recent lessons marked'}</div></div>
    </div>

    <div className="dash-grid">
      <section className="dash-card" aria-label="Lessons per month">
        <h3>Lessons per month</h3>
        <div className="profile-cols" role="img" aria-label={'Bar chart of lessons per month: ' + s.monthly.map(m => `${m.label} ${m.count}`).join(', ')}>
          {s.monthly.map(m => <div className="profile-col" key={m.month} title={`${m.label}: ${m.count} lesson${m.count === 1 ? '' : 's'}`}>
            <span className="profile-col-value">{m.count}</span>
            <span className="profile-col-bar" style={{ height: Math.max(m.count ? 6 : 2, (m.count / max) * 120) + 'px' }} />
            <span className="profile-col-label">{m.label}</span></div>)}
        </div>
      </section>
      <section className="dash-card" aria-label="Attendance not completed">
        <h3>Attendance not completed ({s.missing.length})</h3>
        {s.missing.length === 0 ? <p className="quiet">Every lesson in the last 30 days has a mark for each enrolled student.</p> :
          <ul className="dash-list">{s.missing.slice(0, 6).map(m => <li key={m.sessionId}><span>{formatDate(m.date)} · {m.classTitle}</span>
            <span className="tag amber">{m.marked} of {m.enrolled} marked</span></li>)}</ul>}
        {s.missing.length > 6 && <p className="quiet">and {s.missing.length - 6} more. Open Attendance to complete them.</p>}
      </section>
    </div>

    <section className="dash-card profile-classes" aria-label="Their classes">
      <h3>Classes ({s.classes.length})</h3>
      {s.classes.length === 0 ? <p className="quiet">{member.role === 'teacher' ? 'No class has this teacher yet. Set it under Classes.' : 'Only teachers are given classes.'}</p> :
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Classes of this teacher"><table><thead><tr><th>Class</th><th>Course</th><th>Students</th><th>Attendance (4 weeks)</th><th>Level ends</th></tr></thead><tbody>
          {s.classes.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.course}</td><td>{c.students}</td><td>{c.rate === null ? '—' : c.rate + '%'}</td>
            <td>{c.levelEnd ? <>{formatDate(c.levelEnd)}{daysUntil(c.levelEnd) <= 14 && <> <span className={'tag ' + (daysUntil(c.levelEnd) < 0 ? 'red' : 'amber')}>{endingText(daysUntil(c.levelEnd))}</span></>}</> : <span className="quiet">Not set</span>}</td></tr>)}
        </tbody></table></div>}
    </section>

    {s.classes.length > 0 && <HeatCalendar data={dataForTeacher(data, member.staff_id as string) as Data} today={today} />}
  </section>;
}
