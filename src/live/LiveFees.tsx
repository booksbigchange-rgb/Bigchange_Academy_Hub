import { useMemo, useState, type FormEvent } from 'react';
import { approvePeriod, checkPeriod, childFee, createChildPeriod, logReminder, reportPayment, setGuardianConsent, setPeriodAmount, type FeeStatus } from './api';
import { FEE_TEXT, METHODS, STAGE_LABEL, STATUS_LABEL, bulkReminderText, emailBatches, formatDate, needsReminder, reminderText, remindedText, todayIso, usd, whatsappLink } from './fees.mjs';
import { useAction, type PanelProps, type Role } from './shared';
import { TOUCHES } from './store';

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
  const [confirmConsent, setConfirmConsent] = useState('');
  return <section className="panel operations" aria-label="Parent payments">
    <span className="eyebrow">PARENT PAYMENTS · FORM TEACHER</span><h2>Parent payments for my students</h2>
    <p className="quiet">Payments are made outside this app. When a parent pays, report it here: the date, how they paid, and a note. The record belongs to the parent, so every teacher of that parent’s children sees the same update. Finance checks it and an administrator approves it.</p>
    {data.teacherPeriods.length === 0 ? <p className="quiet">No payment periods have been started for your students’ parents yet. Ask finance to start one.</p> :
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table><thead><tr><th>Parent</th><th>Phone</th><th>My students</th><th>Period</th><th>Fee</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {data.teacherPeriods.map(p => <tr key={p.period_id}><td>{p.guardian_name}</td><td>{p.guardian_phone ?? '—'}</td><td>{p.students.join(', ') || '—'}</td>
          <td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td><td>{usd(p.amount_due)}</td>
          <td>{p.reported_status === 'unpaid' ? '—' : <>{label(STATUS_LABEL, p.reported_status)} on {formatDate(p.paid_on ?? '')} · {methodLabel(p.paid_method)}{p.paid_note ? ' · ' + p.paid_note : ''}</>}</td>
          <td><span className={tagClass(p.status)}>{label(STATUS_LABEL, p.status)}</span><br /><small>{label(STAGE_LABEL, p.stage)}</small></td>
          <td><button className="small-btn" onClick={() => setOpen({ id: p.period_id, periodStart: p.period_start, status: p.reported_status, paidOn: p.paid_on, method: p.paid_method, note: p.paid_note, title: p.guardian_name })}>Report payment</button>
            {needsReminder(p) && <ReminderAction phone={p.guardian_phone} allowed={p.whatsapp_opt_in} lastAt={p.last_reminded_at ?? ''} busy={busy}
              text={reminderText({ guardian: p.guardian_name, students: p.students, amount: p.amount_due, start: p.period_start, end: p.period_end })}
              onSent={() => void run(() => logReminder(client, p.period_id, 'whatsapp'), 'WhatsApp opened with the reminder. The date is recorded.', TOUCHES.reminder)}
              onAllow={confirmConsent === p.guardian_id
                ? () => void run(() => setGuardianConsent(client, p.guardian_id, null, true), 'WhatsApp permission recorded for ' + p.guardian_name + '.', TOUCHES.consent).then(() => setConfirmConsent(''))
                : () => setConfirmConsent(p.guardian_id)}
              confirming={confirmConsent === p.guardian_id} />}</td></tr>)}
      </tbody></table></div>}
    {open && <ReportForm key={open.id} target={open} busy={busy} onCancel={() => setOpen(null)}
      onSubmit={async v => { if (await run(() => reportPayment(client, open.id, v, todayIso(), open.periodStart), 'Payment reported. Finance will check it.', TOUCHES.payment)) setOpen(null); }} />}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}

function StaffFees({ data, client, role, reload }: PanelProps & { role: Role }) {
  const { message, busy, run } = useAction(reload);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<ReportTarget | null>(null);
  const [learnerId, setLearnerId] = useState('');
  const [amountFor, setAmountFor] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [amountReason, setAmountReason] = useState('');
  const [start, setStart] = useState(todayIso());
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');
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
  const childName = (id: string | null) => (id ? data.learners.find(l => l.id === id)?.display_name : undefined);
  // Children who can have their own 3 months: active, with a verified parent.
  const eligibleChildren = data.learners.filter(l => l.active && data.links.some(k => k.learner_id === l.id && k.verified));
  const coursesOf = (learnerId: string) => data.enrollments.filter(e => e.learner_id === learnerId)
    .map(e => data.courses.find(c => c.id === data.classes.find(k => k.id === e.class_id)?.course_id)?.title).filter(Boolean) as string[];

  const lastReminded = (periodId: string) => data.reminders.find(r => r.period_id === periodId)?.sent_at ?? null;
  const textFor = (p: (typeof data.periods)[number]) => reminderText({ guardian: guardian(p.guardian_id)?.display_name ?? 'Parent',
    students: p.learner_id ? [childName(p.learner_id) ?? 'your child'] : info.get(p.guardian_id)?.students ?? [], amount: p.amount_due, start: p.period_start, end: p.period_end });
  const emailable = toRemindAll().filter(p => { const g = guardian(p.guardian_id); return g?.email_opt_in && g.email; });
  function toRemindAll() { return data.periods.filter(p => needsReminder(p)); }
  const batches = emailBatches(emailable.map(p => guardian(p.guardian_id)!.email as string),
    { subject: 'BigChange Academy – payment reminder', body: bulkReminderText() });
  async function logEmails(emails: string[]) {
    const periods = emailable.filter(p => emails.includes(guardian(p.guardian_id)!.email as string));
    await run(async () => { for (const p of periods) await logReminder(client, p.id, 'email'); },
      'Your email app opened with ' + emails.length + ' parents in BCC. Press send there. The reminder date is recorded.', TOUCHES.reminder);
  }
  // Parents to remind: ended and not approved as paid; never-reminded first, then the longest ago.
  const toRemind = data.periods.filter(p => needsReminder(p))
    .sort((a, b) => (lastReminded(a.id) ?? '').localeCompare(lastReminded(b.id) ?? ''));
  const waNumbers = [...new Set(toRemind.map(p => guardian(p.guardian_id)).filter(g => g?.whatsapp_opt_in && g.phone_e164).map(g => g!.phone_e164 as string))];
  async function copyReminder(p: (typeof data.periods)[number]) {
    try { await navigator.clipboard.writeText(textFor(p)); }
    catch { setNote('Copying was blocked by the browser. Nothing was sent.'); return; }
    await run(() => logReminder(client, p.id, 'copied'), 'Reminder text copied (date recorded). Paste it into your own message.', TOUCHES.reminder);
  }
  async function copyNumbers() {
    try { await navigator.clipboard.writeText(waNumbers.join('\n')); setNote(waNumbers.length + ' WhatsApp numbers copied. In WhatsApp you can make a broadcast list with them. Nothing was sent.'); }
    catch { setNote('Copying was blocked by the browser.'); }
  }
  async function showFee() {
    setPreview('');
    try {
      const f = await childFee(client, learnerId);
      setPreview(childName(learnerId) + ': ' + f.child_courses + ' course' + (f.child_courses === 1 ? '' : 's') + '; the family has ' + f.family_courses + ' in total → ' + usd(f.amount_due) + ' for these 3 months.');
    } catch (error) { setPreview(error instanceof Error ? error.message : 'Could not work out the fee'); }
  }
  return <section className="panel operations" aria-label="Parent payments">
    <span className="eyebrow">PARENT PAYMENTS · TRACKING ONLY</span><h2>Parent payment periods</h2>
    <p className="quiet">Parents pay outside this app, every 3 months per child, counted from the day each child starts: {usd(FEE_TEXT.single)} if the family has one course in total, otherwise {usd(FEE_TEXT.multi)} per course. A form teacher reports a payment, finance checks it, and an administrator approves it.</p>
    <div className="finance-strip">
      <div><small>Paid</small><strong>{counts.paid}</strong></div><div><small>Partly paid</small><strong>{counts.partial}</strong></div>
      <div><small>Unpaid</small><strong>{counts.unpaid}</strong></div><div><small>Overdue</small><strong>{counts.overdue}</strong></div>
      <div><small>Awaiting check</small><strong>{counts.review}</strong></div><div><small>Awaiting approval</small><strong>{counts.approval}</strong></div></div>

    <div className="people-enroll"><h3>Start a child's 3 months</h3>
      <p className="quiet">Each child's 3 months start on the day that child starts. A brother or sister who joins later gets their own dates; the parent may still pay for both on the same day.</p>
      <label>Child<select value={learnerId} onChange={e => { setLearnerId(e.target.value); setPreview(''); }}><option value="">Choose a child</option>
        {eligibleChildren.map(l => <option key={l.id} value={l.id}>{l.display_name}{coursesOf(l.id).length ? ' · ' + coursesOf(l.id).join(', ') : ' · no class yet'}</option>)}</select></label>
      <label>First day of the 3 months<input type="date" value={start} onChange={e => { setStart(e.target.value); setPreview(''); }} /></label>
      {eligibleChildren.length === 0 && <p className="quiet">No child has a verified parent yet. Add the parent when adding the student, or verify the link under Guardians.</p>}
      <button className="small-btn" type="button" disabled={!learnerId || busy} onClick={() => void showFee()}>Show fee</button>
      {preview && <p role="status">{preview}</p>}
      <button className="primary-btn" type="button" disabled={!learnerId || !start || busy}
        onClick={() => void run(() => createChildPeriod(client, learnerId, start), 'Started. It runs for 3 months from ' + formatDate(start) + '.', TOUCHES.payment)}>Start 3 months</button>
    </div>

    <div className="people-enroll" aria-label="Parents to remind"><h3>Parents to remind ({toRemind.length})</h3>
      <p className="quiet">Families whose 3 months have ended without an approved payment. They become Overdue 14 days after the end. "Send on WhatsApp" opens WhatsApp with the reminder written; you press send. Only parents who agreed to WhatsApp have the button.</p>
      {toRemind.length === 0 ? <p className="quiet">Nobody to remind right now.</p> : <>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table><thead><tr><th>Parent</th><th>Fee</th><th>Status</th><th>Last reminder</th><th>Send</th></tr></thead><tbody>
          {toRemind.map(p => { const g = guardian(p.guardian_id); return <tr key={p.id}>
            <td>{g?.display_name ?? 'Parent'}<br /><small>{g?.phone_e164 ?? 'no phone'}</small></td><td>{usd(p.amount_due)}</td>
            <td><span className={tagClass(p.status)}>{label(STATUS_LABEL, p.status)}</span></td><td>{remindedText(lastReminded(p.id))}</td>
            <td><ReminderAction phone={g?.phone_e164 ?? null} allowed={Boolean(g?.whatsapp_opt_in)} lastAt={null} busy={busy} text={textFor(p)}
              onSent={() => void run(() => logReminder(client, p.id, 'whatsapp'), 'WhatsApp opened with the reminder. The date is recorded.', TOUCHES.reminder)} />
              {' '}<button className="small-btn" type="button" disabled={busy} onClick={() => void copyReminder(p)}>Copy text</button></td></tr>; })}
        </tbody></table></div>
        <button className="small-btn" type="button" disabled={!waNumbers.length} onClick={() => void copyNumbers()}>Copy WhatsApp numbers ({waNumbers.length}) for a broadcast list</button>
        <h4>Email everyone who agreed to email ({emailable.length})</h4>
        {batches.length === 0 ? <p className="quiet">No parent in this list has agreed to email.</p> :
          <p>{batches.map((b, i) => <a key={i} className="small-btn" href={b.href} onClick={() => void logEmails(b.emails)}>
            {batches.length > 1 ? `Email group ${i + 1} (${b.emails.length})` : `Email ${b.emails.length} parent${b.emails.length === 1 ? '' : 's'}`}</a>)}</p>}
        <p className="quiet">Opens your own email app (for example Gmail) with the parents in BCC, so they cannot see each other's addresses. Free. You press send.</p>
      </>}
    </div>

    <label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All</option><option value="unpaid">Unpaid</option><option value="partial">Partly paid</option>
      <option value="paid">Paid</option><option value="overdue">Overdue</option><option value="review">Awaiting check</option><option value="approval">Awaiting approval</option></select></label>
    {rows.length === 0 ? <p className="quiet">No payment periods yet.</p> :
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table><thead><tr><th>Parent</th><th>Child and courses</th><th>Period</th><th>Fee</th><th>Reported payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {rows.map(p => { const g = guardian(p.guardian_id); const i = info.get(p.guardian_id); return <tr key={p.id}>
          <td>{g?.display_name ?? 'Parent'}<br /><small>{g?.phone_e164 ?? ''}</small></td>
          <td>{p.learner_id ? (childName(p.learner_id) ?? 'Child') + ': ' + (coursesOf(p.learner_id).join(', ') || '—') : (i?.courses.length ? i.courses.join('; ') : i?.students.join(', ') ?? '—')}</td>
          <td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td>
          <td>{usd(p.amount_due)}{role === 'admin' && <><br /><button className="text-btn" type="button" onClick={() => { setAmountFor(p.id); setNewAmount(String(p.amount_due)); setAmountReason(''); }}>Change amount</button></>}
            {amountFor === p.id && <form onSubmit={e => { e.preventDefault(); void run(() => setPeriodAmount(client, p.id, Number(newAmount), amountReason), 'Amount changed. The old amount and the reason are kept.', TOUCHES.payment).then(ok => { if (ok) setAmountFor(''); }); }}>
              <label>New amount (USD)<input type="number" min="1" step="1" required value={newAmount} onChange={e => setNewAmount(e.target.value)} /></label>
              <label>Reason<input required minLength={3} maxLength={200} value={amountReason} onChange={e => setAmountReason(e.target.value)} placeholder="e.g. second child joined" /></label>
              <button className="small-btn" type="submit" disabled={busy}>Save amount</button> <button className="text-btn" type="button" onClick={() => setAmountFor('')}>Cancel</button>
            </form>}</td>
          <td>{p.reported_status === 'unpaid' ? '—' : <>{label(STATUS_LABEL, p.reported_status)} on {formatDate(p.paid_on ?? '')} · {methodLabel(p.paid_method)}{p.paid_note ? ' · ' + p.paid_note : ''}</>}</td>
          <td><span className={tagClass(p.status)}>{label(STATUS_LABEL, p.status)}</span><br /><small>{label(STAGE_LABEL, p.stage)}</small></td>
          <td><button className="small-btn" onClick={() => setOpen({ id: p.id, periodStart: p.period_start, status: p.reported_status, paidOn: p.paid_on, method: p.paid_method, note: p.paid_note, title: g?.display_name ?? 'Parent' })}>Report</button>
            {p.stage === 'reported' && <> <button className="small-btn" disabled={busy} onClick={() => void run(() => checkPeriod(client, p.id, p.reported_status), 'Checked. An administrator can now approve it.', TOUCHES.payment)}>Check “{label(STATUS_LABEL, p.reported_status)}”</button></>}
            {p.stage === 'checked' && role === 'admin' && <> <button className="small-btn" disabled={busy} onClick={() => void run(() => approvePeriod(client, p.id, p.checked_status), 'Approved.', TOUCHES.payment)}>Approve “{label(STATUS_LABEL, p.checked_status)}”</button></>}
          </td></tr>; })}
      </tbody></table></div>}
    {open && <ReportForm key={open.id} target={open} busy={busy} onCancel={() => setOpen(null)}
      onSubmit={async v => { if (await run(() => reportPayment(client, open.id, v, todayIso(), open.periodStart), 'Payment reported. It now needs a finance check.', TOUCHES.payment)) setOpen(null); }} />}
    <p className="ops-feedback" role="status" aria-live="polite">{message || note}</p>
  </section>;
}

/** "Send on WhatsApp": opens WhatsApp with the reminder filled in; the click is recorded. Hidden without the parent's permission. */
function ReminderAction({ phone, allowed, lastAt, text, busy, onSent, onAllow, confirming }: {
  phone: string | null; allowed: boolean; lastAt: string | null; text: string; busy: boolean; onSent: () => void; onAllow?: () => void; confirming?: boolean }) {
  const link = allowed ? whatsappLink(phone, text) : null;
  return <>
    {link ? <a className="small-btn" href={link} target="_blank" rel="noopener noreferrer" onClick={onSent}>Send on WhatsApp</a>
      : !phone ? <small> No phone number</small>
      : onAllow ? <button className="small-btn" type="button" disabled={busy} onClick={onAllow}>{confirming ? 'Confirm: parent agreed to WhatsApp' : 'Record WhatsApp permission'}</button>
      : <small> No WhatsApp permission</small>}
    {lastAt !== null && <><br /><small>{remindedText(lastAt)}</small></>}
  </>;
}
