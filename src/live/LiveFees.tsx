import { useMemo, useState, type FormEvent } from 'react';
import { approvePeriod, checkPeriod, createPeriod, familyFee, reportPayment, type FeeStatus } from './api';
import { FEE_TEXT, METHODS, STAGE_LABEL, STATUS_LABEL, formatDate, todayIso, usd } from './fees.mjs';
import { useAction, type PanelProps, type Role } from './shared';

const tagClass = (s: string) => 'tag ' + (s === 'paid' ? 'green' : s === 'overdue' ? 'red' : 'amber');
const label = (map: Record<string, string>, key: string) => map[key] ?? key;
const methodLabel = (m: string | null) => METHODS.find(([k]: string[]) => k === m)?.[1] ?? '—';

type ReportTarget = { id: string; periodStart: string; status: FeeStatus; paidOn: string | null; method: string | null; note: string | null; title: string };

/** Report what a parent paid. Anyone allowed to report sees the same record, so every teacher of the parent's children stays up to date. */
function ReportForm({ target, busy, onSubmit, onCancel }: { target: ReportTarget; busy: boolean; onSubmit: (v: { status: FeeStatus; paidOn: string; method: string; note: string }) => void; onCancel: () => void }) {
  const [status, setStatus] = useState<FeeStatus>(target.status === 'unpaid' ? 'paid' : target.status);
  const [paidOn, setPaidOn] = useState(target.paidOn ?? todayIso());
  const [method, setMethod] = useState(target.method ?? '');
  const [note, setNote] = useState(target.note ?? '');
  function submit(event: FormEvent) { event.preventDefault(); onSubmit({ status, paidOn, method, note }); }
  return <form className="ops-form" onSubmit={submit}>
    <h3>Report payment · {target.title}</h3>
    <label>Status<select value={status} onChange={e => setStatus(e.target.value as FeeStatus)}>
      <option value="paid">Paid</option><option value="partial">Partly paid</option><option value="unpaid">Unpaid (clear the report)</option></select></label>
    {status !== 'unpaid' && <>
      <label>Date the parent paid<input type="date" required max={todayIso()} value={paidOn} onChange={e => setPaidOn(e.target.value)} /></label>
      <label>How they paid<select required value={method} onChange={e => setMethod(e.target.value)}><option value="">Choose</option>
        {METHODS.map(([k, v]: string[]) => <option key={k} value={k}>{v}</option>)}</select></label></>}
    <label>Note or reference (optional, max 120)<input maxLength={120} value={note} onChange={e => setNote(e.target.value)} /></label>
    <p className="quiet">Finance will check this and an administrator will approve it. Changing a report later sends it back for checking.</p>
    <button className="primary-btn" type="submit" disabled={busy}>Save report</button>
    <button className="text-btn" type="button" onClick={onCancel}>Cancel</button>
  </form>;
}

export default function LiveFees(props: PanelProps & { role: Role }) {
  return props.role === 'teacher' ? <TeacherFees {...props} /> : <StaffFees {...props} />;
}

function TeacherFees({ data, client, reload }: PanelProps & { role: Role }) {
  const { message, busy, run } = useAction(reload);
  const [open, setOpen] = useState<ReportTarget | null>(null);
  return <section className="panel operations" aria-label="Parent payments">
    <span className="eyebrow">PARENT PAYMENTS · FORM TEACHER</span><h2>Parent payments for my students</h2>
    <p className="quiet">Payments are made outside this app. When a parent pays, report it here: the date, how they paid, and a note. The record belongs to the parent, so every teacher of that parent’s children sees the same update. Finance checks it and an administrator approves it.</p>
    {data.teacherPeriods.length === 0 ? <p className="quiet">No payment periods have been started for your students’ parents yet. Ask finance to start one.</p> :
      <div className="table-wrap"><table><thead><tr><th>Parent</th><th>Phone</th><th>My students</th><th>Period</th><th>Fee</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {data.teacherPeriods.map(p => <tr key={p.period_id}><td>{p.guardian_name}</td><td>{p.guardian_phone ?? '—'}</td><td>{p.students.join(', ') || '—'}</td>
          <td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td><td>{usd(p.amount_due)}</td>
          <td>{p.reported_status === 'unpaid' ? '—' : <>{label(STATUS_LABEL, p.reported_status)} on {formatDate(p.paid_on ?? '')} · {methodLabel(p.paid_method)}{p.paid_note ? ' · ' + p.paid_note : ''}</>}</td>
          <td><span className={tagClass(p.status)}>{label(STATUS_LABEL, p.status)}</span><br /><small>{label(STAGE_LABEL, p.stage)}</small></td>
          <td><button className="small-btn" onClick={() => setOpen({ id: p.period_id, periodStart: p.period_start, status: p.reported_status, paidOn: p.paid_on, method: p.paid_method, note: p.paid_note, title: p.guardian_name })}>Report payment</button></td></tr>)}
      </tbody></table></div>}
    {open && <ReportForm key={open.id} target={open} busy={busy} onCancel={() => setOpen(null)}
      onSubmit={async v => { if (await run(() => reportPayment(client, open.id, v, todayIso(), open.periodStart), 'Payment reported. Finance will check it.')) setOpen(null); }} />}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}

function StaffFees({ data, client, role, reload }: PanelProps & { role: Role }) {
  const { message, busy, run } = useAction(reload);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<ReportTarget | null>(null);
  const [guardianId, setGuardianId] = useState('');
  const [start, setStart] = useState(todayIso());
  const [preview, setPreview] = useState('');
  const guardian = (id: string) => data.guardians.find(g => g.id === id);
  const info = useMemo(() => {
    const map = new Map<string, { students: string[]; courses: string[] }>();
    const courseOfClass = new Map(data.classes.map(c => [c.id, data.courses.find(x => x.id === c.course_id)?.title ?? '—']));
    for (const l of data.links.filter(x => x.verified)) {
      const entry = map.get(l.guardian_id) ?? { students: [], courses: [] };
      const learner = data.learners.find(x => x.id === l.learner_id);
      if (learner) entry.students.push(learner.display_name);
      for (const e of data.enrollments.filter(x => x.learner_id === l.learner_id)) {
        const course = courseOfClass.get(e.class_id);
        if (course && learner) entry.courses.push(learner.display_name + ': ' + course);
      }
      map.set(l.guardian_id, entry);
    }
    return map;
  }, [data]);
  const counts = { paid: 0, partial: 0, unpaid: 0, overdue: 0, review: 0, approval: 0 };
  for (const p of data.periods) { counts[p.status]++; if (p.stage === 'reported') counts.review++; if (p.stage === 'checked') counts.approval++; }
  const rows = data.periods.filter(p => filter === 'all' || p.status === filter || (filter === 'review' && p.stage === 'reported') || (filter === 'approval' && p.stage === 'checked'));
  const eligible = data.guardians.filter(g => data.links.some(l => l.guardian_id === g.id && l.verified));

  async function showFee() {
    setPreview('');
    try { const f = await familyFee(client, guardianId); setPreview(f.course_count + ' course' + (f.course_count === 1 ? '' : 's') + ' in total → ' + usd(f.amount_due) + ' for this 3-month period.'); }
    catch (error) { setPreview(error instanceof Error ? error.message : 'Could not work out the fee'); }
  }
  return <section className="panel operations" aria-label="Parent payments">
    <span className="eyebrow">PARENT PAYMENTS · TRACKING ONLY</span><h2>Parent payment periods</h2>
    <p className="quiet">Parents pay outside this app, once per 3-month period for all their children’s courses: {usd(FEE_TEXT.single)} if the family has one course in total, otherwise {usd(FEE_TEXT.multi)} per course. A form teacher reports a payment, finance checks it, and an administrator approves it.</p>
    <div className="finance-strip">
      <div><small>Paid</small><strong>{counts.paid}</strong></div><div><small>Partly paid</small><strong>{counts.partial}</strong></div>
      <div><small>Unpaid</small><strong>{counts.unpaid}</strong></div><div><small>Overdue</small><strong>{counts.overdue}</strong></div>
      <div><small>Awaiting check</small><strong>{counts.review}</strong></div><div><small>Awaiting approval</small><strong>{counts.approval}</strong></div></div>

    <div className="people-enroll"><h3>Start a 3-month period for a parent</h3>
      <label>Parent<select value={guardianId} onChange={e => { setGuardianId(e.target.value); setPreview(''); }}><option value="">Choose a parent</option>
        {eligible.map(g => <option key={g.id} value={g.id}>{g.display_name}{g.phone_e164 ? ' · ' + g.phone_e164 : ''}</option>)}</select></label>
      <label>Period starts on<input type="date" value={start} onChange={e => { setStart(e.target.value); setPreview(''); }} /></label>
      {eligible.length === 0 && <p className="quiet">No parent has a verified child link yet. Add a guardian and verify the link under Guardians.</p>}
      <button className="small-btn" type="button" disabled={!guardianId || busy} onClick={() => void showFee()}>Show fee</button>
      {preview && <p role="status">{preview}</p>}
      <button className="primary-btn" type="button" disabled={!guardianId || !start || busy}
        onClick={() => void run(() => createPeriod(client, guardianId, start), 'Period started. It runs for 3 months from the start date.')}>Start period</button>
    </div>

    <label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All</option><option value="unpaid">Unpaid</option><option value="partial">Partly paid</option>
      <option value="paid">Paid</option><option value="overdue">Overdue</option><option value="review">Awaiting check</option><option value="approval">Awaiting approval</option></select></label>
    {rows.length === 0 ? <p className="quiet">No payment periods yet.</p> :
      <div className="table-wrap"><table><thead><tr><th>Parent</th><th>Students and courses</th><th>Period</th><th>Fee</th><th>Reported payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {rows.map(p => { const g = guardian(p.guardian_id); const i = info.get(p.guardian_id); return <tr key={p.id}>
          <td>{g?.display_name ?? 'Parent'}<br /><small>{g?.phone_e164 ?? ''}</small></td>
          <td>{i?.courses.length ? i.courses.join('; ') : i?.students.join(', ') ?? '—'}</td>
          <td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td><td>{usd(p.amount_due)}</td>
          <td>{p.reported_status === 'unpaid' ? '—' : <>{label(STATUS_LABEL, p.reported_status)} on {formatDate(p.paid_on ?? '')} · {methodLabel(p.paid_method)}{p.paid_note ? ' · ' + p.paid_note : ''}</>}</td>
          <td><span className={tagClass(p.status)}>{label(STATUS_LABEL, p.status)}</span><br /><small>{label(STAGE_LABEL, p.stage)}</small></td>
          <td><button className="small-btn" onClick={() => setOpen({ id: p.id, periodStart: p.period_start, status: p.reported_status, paidOn: p.paid_on, method: p.paid_method, note: p.paid_note, title: g?.display_name ?? 'Parent' })}>Report</button>
            {p.stage === 'reported' && <> <button className="small-btn" disabled={busy} onClick={() => void run(() => checkPeriod(client, p.id, p.reported_status), 'Checked. An administrator can now approve it.')}>Check “{label(STATUS_LABEL, p.reported_status)}”</button></>}
            {p.stage === 'checked' && role === 'admin' && <> <button className="small-btn" disabled={busy} onClick={() => void run(() => approvePeriod(client, p.id, p.checked_status), 'Approved.')}>Approve “{label(STATUS_LABEL, p.checked_status)}”</button></>}
          </td></tr>; })}
      </tbody></table></div>}
    {open && <ReportForm key={open.id} target={open} busy={busy} onCancel={() => setOpen(null)}
      onSubmit={async v => { if (await run(() => reportPayment(client, open.id, v, todayIso(), open.periodStart), 'Payment reported. It now needs a finance check.')) setOpen(null); }} />}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
