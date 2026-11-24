import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardiansForLearner, type GuardianContact, type Learner, type PeriodRow } from './api';
import { dataForLearner, studentStats } from './dashboard.mjs';
import { STATUS_LABEL, daysUntil, endingText, formatDate, todayIso, usd } from './fees.mjs';
import { studentHistory } from './validation.mjs';
import { HeatCalendar } from './LiveOverview';
import type { Data, Role } from './shared';

type Parent = { id: string; name: string; phone: string | null; email: string | null; whatsapp: boolean; emailOk: boolean; verified: boolean };
type Stats = {
  classes: Array<{ id: string; title: string; course: string; teacher: string | null; levelStart: string | null; levelEnd: string | null; rate: number | null; lessons: number }>;
  recent: { rate: number | null; before: number | null }; overall: number | null; marks: number;
  periods: PeriodRow[]; current: PeriodRow | null; guardians: Parent[];
};
const MARK: Record<string, string> = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };
const statusTag = (s: string) => 'tag ' + (s === 'paid' ? 'green' : s === 'overdue' ? 'red' : 'amber');

/** One student at a glance. Each role only sees what the database lets it read (teachers: their own students; finance: no attendance). */
export default function LiveStudentProfile({ learner, data, role, client, onClose }: { learner: Learner; data: Data; role: Role; client: SupabaseClient; onClose: () => void }) {
  const today = todayIso();
  const s: Stats = studentStats(data, learner.id, today);
  const seesPayments = role === 'admin' || role === 'finance';
  const seesAttendance = role === 'admin' || role === 'teacher';
  const history = studentHistory(learner.id, data);
  // Teachers do not load the parent directory; they read this child's contacts through the same check as the Guardians screen.
  const [contacts, setContacts] = useState<Parent[] | null>(role === 'teacher' ? null : s.guardians);
  useEffect(() => {
    if (role !== 'teacher') return;
    let live = true;
    guardiansForLearner(client, learner.id)
      .then((rows: GuardianContact[]) => { if (live) setContacts(rows.map(g => ({ id: g.guardian_id, name: g.display_name, phone: g.phone_e164, email: g.email, whatsapp: g.whatsapp_opt_in, emailOk: g.email_opt_in, verified: g.verified }))); })
      .catch(() => { if (live) setContacts([]); });
    return () => { live = false; };
  }, [client, learner.id, role]);
  const parents = role === 'teacher' ? contacts : s.guardians;
  const initials = learner.display_name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  return <section className="profile" aria-label={'Profile of ' + learner.display_name}>
    <div className="profile-head">
      <div className="profile-avatar" aria-hidden="true">{initials}</div>
      <div className="profile-id">
        <h3>{learner.display_name}</h3>
        <div className="profile-meta">
          <span className={'tag ' + (learner.active ? 'green' : 'amber')}>{learner.active ? 'Active' : 'Inactive'}</span>
          <span>{learner.grade_level ?? 'Grade not set'}</span>
          {learner.note && <span>Note: {learner.note}</span>}
        </div>
      </div>
      <button className="small-btn" type="button" onClick={onClose}>Close profile</button>
    </div>

    <div className="metric-grid profile-cards">
      <div className="metric metric-hero"><div className="metric-value">{s.classes.length}</div><div className="metric-title">Classes</div><div className="metric-subtitle">{s.classes.map(c => c.course).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Not enrolled yet'}</div></div>
      {seesAttendance && <div className="metric"><div className="metric-value">{s.recent.rate === null ? '—' : s.recent.rate + '%'}</div><div className="metric-title">Attendance (4 weeks)</div><div className="metric-subtitle">{s.overall === null ? 'No marks yet' : `${s.overall}% overall · ${s.marks} lesson${s.marks === 1 ? '' : 's'} marked`}</div></div>}
      {seesPayments && <div className="metric"><div className="metric-value">{s.current ? usd(s.current.amount_due) : '—'}</div><div className="metric-title">Current 3 months</div>
        <div className="metric-subtitle">{s.current ? <><span className={statusTag(s.current.status)}>{STATUS_LABEL[s.current.status] ?? s.current.status}</span> until {formatDate(s.current.period_end)}</> : 'No period started yet'}</div></div>}
      <div className="metric"><div className="metric-value">{parents === null ? '…' : parents.length}</div><div className="metric-title">Parents on file</div><div className="metric-subtitle">{parents && parents.some(p => !p.verified) ? 'Some waiting for verification' : 'Verified'}</div></div>
    </div>

    <div className="dash-grid">
      <section className="dash-card" aria-label="Parents">
        <h3>Parents</h3>
        {parents === null ? <p role="status">Loading…</p> : parents.length === 0 ? <p className="quiet">No parent recorded yet. Add one under Guardians.</p> :
          <ul className="dash-list">{parents.map(p => <li key={p.id}><span><strong>{p.name}</strong><br /><small>{[p.phone, p.email].filter(Boolean).join(' · ') || 'No contact shown'}</small></span>
            <span>{p.verified ? <>{p.whatsapp && <span className="tag green">WhatsApp OK</span>} {p.emailOk && <span className="tag green">Email OK</span>}</> : <span className="tag amber">Waiting for verification</span>}</span></li>)}</ul>}
      </section>
      <section className="dash-card" aria-label="Classes and teachers">
        <h3>Classes and teachers</h3>
        {s.classes.length === 0 ? <p className="quiet">Not enrolled in a class yet. Enroll under Classes → View.</p> :
          <ul className="dash-list">{s.classes.map(c => <li key={c.id}><span><strong>{c.title}</strong><br /><small>{c.course}{c.teacher ? ' · ' + c.teacher : ''}{c.levelEnd ? ' · level ends ' + formatDate(c.levelEnd) : ''}</small></span>
            <span>{c.levelEnd && daysUntil(c.levelEnd) <= 14 && <span className={'tag ' + (daysUntil(c.levelEnd) < 0 ? 'red' : 'amber')}>{endingText(daysUntil(c.levelEnd))}</span>}{seesAttendance && <> {c.rate === null ? '—' : c.rate + '%'}</>}</span></li>)}</ul>}
      </section>
    </div>

    {seesPayments && <section className="dash-card profile-classes" aria-label="Payment history">
      <h3>Payment history ({s.periods.length})</h3>
      {s.periods.length === 0 ? <p className="quiet">No 3-month period has been started for this student. Start one under Fees.</p> :
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Payment periods of this student"><table><thead><tr><th>Period</th><th>Fee</th><th>Status</th><th>Reported</th></tr></thead><tbody>
          {s.periods.map(p => <tr key={p.id}><td>{formatDate(p.period_start)} – {formatDate(p.period_end)}{p.id === s.current?.id && <> <span className="tag amber">Current</span></>}</td><td>{usd(p.amount_due)}</td>
            <td><span className={statusTag(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
            <td>{p.reported_status === 'unpaid' ? '—' : <>{STATUS_LABEL[p.reported_status]} on {formatDate(p.paid_on ?? '')}{p.paid_amount ? ' · ' + usd(p.paid_amount) : ''}</>}</td></tr>)}
        </tbody></table></div>}
    </section>}

    {seesAttendance && <>
      <HeatCalendar data={dataForLearner(data, learner.id) as Data} today={today} title="Attendance, last 4 weeks"
        note="Each square is a day with a lesson: dark blue = present (100%), light = absent (0%). Empty squares had no lesson." />
      <section className="dash-card profile-classes" aria-label="Recent lessons">
        <h3>Recent lessons</h3>
        {history.rows.length === 0 ? <p className="quiet">No attendance recorded yet.</p> :
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Recent lessons of this student"><table><thead><tr><th>Date</th><th>Class</th><th>Mark</th></tr></thead><tbody>
            {history.rows.slice(0, 10).map((r: { date: string; classTitle: string; status: string }, i: number) => <tr key={i}><td>{formatDate(r.date)}</td><td>{r.classTitle}</td><td>{MARK[r.status] ?? r.status}</td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </section>;
}
