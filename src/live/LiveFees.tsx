import { useMemo, useState } from 'react';
import { approveFeeStatus, createFees, recordFeeStatus, type FeeStatus } from './api';
import { FEE_RATES, planQuarterFees, quarterLabel, quarterOptions, quarterStart } from './fees.mjs';
import { useAction, type PanelProps, type Role } from './shared';

const LABEL: Record<string, string> = { paid: 'Paid', partial: 'Partly paid', unpaid: 'Unpaid', overdue: 'Overdue' };
const tagClass = (s: string) => 'tag ' + (s === 'paid' ? 'green' : s === 'overdue' ? 'red' : 'amber');
const etb = (n: number) => 'ETB ' + Number(n).toLocaleString('en-US');

export default function LiveFees(props: PanelProps & { role: Role }) {
  return props.role === 'teacher' ? <TeacherFees data={props.data} /> : <StaffFees {...props} />;
}

function TeacherFees({ data }: { data: PanelProps['data'] }) {
  const learner = (id: string) => data.learners.find(l => l.id === id)?.display_name ?? 'Unknown student';
  const course = (id: string | null) => data.courses.find(c => c.id === id)?.title ?? '—';
  return <section className="panel operations" aria-label="Payment status">
      <span className="eyebrow">PAYMENT STATUS · VIEW ONLY</span><h2>Payment status of my students</h2>
      <p className="quiet">Updated automatically when finance records a payment and an administrator approves it. Teachers cannot change this.</p>
      {data.teacherFees.length === 0 ? <p className="quiet">No fee information for your students yet.</p> :
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Quarter</th><th>Status</th></tr></thead><tbody>
          {data.teacherFees.map(f => <tr key={f.learner_id + f.course_id + f.period}><td>{learner(f.learner_id)}</td><td>{course(f.course_id)}</td>
            <td>{quarterLabel(f.period)}</td><td><span className={tagClass(f.status)}>{LABEL[f.status]}</span></td></tr>)}
        </tbody></table></div>}
  </section>;
}

function StaffFees({ data, client, role, reload }: PanelProps & { role: Role }) {
  const { message, busy, run } = useAction(reload);
  const [period, setPeriod] = useState(quarterStart());
  const [filter, setFilter] = useState('all');
  const learner = (id: string) => data.learners.find(l => l.id === id)?.display_name ?? 'Unknown student';
  const course = (id: string | null) => data.courses.find(c => c.id === id)?.title ?? '—';
  const guardian = (id: string | null) => data.guardians.find(g => g.id === id)?.display_name ?? '—';

  const rows = data.fees.filter(f => f.period === period && (filter === 'all' || f.status === filter || (filter === 'pending' && f.pending_approval)));
  const counts = useMemo(() => {
    const c = { paid: 0, partial: 0, unpaid: 0, overdue: 0, pending: 0 };
    for (const f of data.fees.filter(x => x.period === period)) { c[f.status]++; if (f.pending_approval) c.pending++; }
    return c;
  }, [data.fees, period]);
  const plan = useMemo(() => planQuarterFees({ period, learners: data.learners, links: data.links, enrollments: data.enrollments, classes: data.classes,
    existing: data.fees.map(f => ({ learner_id: f.learner_id, course_id: f.course_id, period: f.period })) }), [period, data]);
  const names = plan.skippedNoGuardian.map(id => learner(id));

  return <section className="panel operations" aria-label="Fees">
    <span className="eyebrow">FEES · TRACKING ONLY</span><h2>Quarterly course fees</h2>
    <p className="quiet">Parents pay outside this app. Finance records what was paid; an administrator approves it. Fee: {etb(FEE_RATES.single)} for a family with one course, {etb(FEE_RATES.multi)} per course for families with two or more.</p>
    <label>Quarter<select value={period} onChange={e => setPeriod(e.target.value)}>
      {quarterOptions().map((p: string) => <option key={p} value={p}>{quarterLabel(p)}</option>)}</select></label>
    <div className="finance-strip">
      <div><small>Paid</small><strong>{counts.paid}</strong></div><div><small>Partly paid</small><strong>{counts.partial}</strong></div>
      <div><small>Unpaid</small><strong>{counts.unpaid}</strong></div><div><small>Overdue</small><strong>{counts.overdue}</strong></div>
      <div><small>Awaiting approval</small><strong>{counts.pending}</strong></div></div>

    <div className="people-enroll"><h3>Create fees for {quarterLabel(period)}</h3>
      <p>{plan.toCreate.length} new fee{plan.toCreate.length === 1 ? '' : 's'} to create ({etb(plan.total)} in total); {plan.alreadyExist.length} already exist.</p>
      {names.length > 0 && <p className="quiet">Skipped, no verified guardian: {names.join(', ')}. Add and verify a guardian first.</p>}
      <button className="primary-btn" disabled={busy || plan.toCreate.length === 0}
        onClick={() => void run(() => createFees(client, plan.toCreate), 'Fees created for ' + quarterLabel(period) + '.')}>Create {plan.toCreate.length} fee{plan.toCreate.length === 1 ? '' : 's'}</button>
    </div>

    <label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All</option><option value="unpaid">Unpaid</option>
      <option value="partial">Partly paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="pending">Awaiting approval</option></select></label>
    {rows.length === 0 ? <p className="quiet">No fees for this quarter yet.</p> :
      <div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Guardian</th><th>Fee</th><th>Recorded by finance</th><th>Status</th>{role === 'admin' && <th>Approval</th>}</tr></thead><tbody>
        {rows.map(f => <tr key={f.obligation_id}><td>{learner(f.learner_id)}</td><td>{course(f.course_id)}</td><td>{guardian(f.guardian_id)}</td><td>{etb(f.amount_due)}</td>
          <td><select aria-label={'Recorded status for ' + learner(f.learner_id)} value={f.recorded_status} disabled={busy}
            onChange={e => void run(() => recordFeeStatus(client, f.obligation_id, e.target.value as FeeStatus), 'Payment status recorded. It shows to others after approval.')}>
            <option value="unpaid">Unpaid</option><option value="partial">Partly paid</option><option value="paid">Paid</option></select></td>
          <td><span className={tagClass(f.status)}>{LABEL[f.status]}</span>{f.pending_approval && <> <span className="tag amber">Awaiting approval</span></>}</td>
          {role === 'admin' && <td>{f.pending_approval ? <button className="small-btn" disabled={busy}
            onClick={() => void run(() => approveFeeStatus(client, f.obligation_id, f.recorded_status), 'Approved.')}>Approve “{LABEL[f.recorded_status]}”</button> : '—'}</td>}</tr>)}
      </tbody></table></div>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
