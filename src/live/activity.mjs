// Turns rows of academy_audit_events (written by database triggers, admin-readable only) into plain sentences.
// INSERT rows carry the new record in `detail`, UPDATE rows {before, after}, DELETE rows the old record;
// CHANGE_AMOUNT and SET_CONSENT are written by their functions with their own small detail.

const STATUS = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid' };
const MARK = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };
const ROLE = { admin: 'Admin', teacher: 'Teacher', finance: 'Finance' };
export const CATEGORIES = ['Payments', 'Attendance', 'Classes', 'Parents', 'Staff', 'Other'];
const CATEGORY = {
  academy_fee_periods: 'Payments', academy_fee_obligations: 'Payments', academy_external_payments: 'Payments',
  academy_attendance: 'Attendance', academy_enrollments: 'Classes',
  academy_guardian_links: 'Parents', academy_guardians: 'Parents', academy_staff: 'Staff',
};
const fmt = iso => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const money = n => 'USD ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Lookups built once from the loaded data. */
export function activityLookups(data) {
  const by = (rows, key = 'id') => new Map(rows.map(r => [r[key], r]));
  return {
    learners: by(data.learners), classes: by(data.classes), sessions: by(data.sessions), guardians: by(data.guardians),
    periods: by(data.periods), staff: by(data.staff), staffByAuth: by(data.staff.filter(s => s.auth_user_id), 'auth_user_id'),
    methods: by(data.paymentMethods, 'code'),
  };
}

/** One audit row → { id, at, who, category, text }. */
export function describeEvent(ev, L) {
  const d = ev.detail ?? {};
  const before = d.before ?? null, after = d.after ?? null;
  const row = after ?? d;
  const who = ev.actor_id ? (L.staffByAuth.get(ev.actor_id)?.display_name ?? 'A former staff account') : 'System';
  const child = id => L.learners.get(id)?.display_name ?? 'a student';
  const parent = id => L.guardians.get(id)?.display_name ?? 'a parent';
  const cls = id => L.classes.get(id)?.title ?? 'a class';
  const staffName = r => r?.display_name ?? L.staff.get(r?.id)?.display_name ?? 'a staff member';
  const periodOwner = p => (p?.learner_id ? child(p.learner_id) : p?.guardian_id ? 'the family of ' + parent(p.guardian_id) : 'a family');
  const method = code => L.methods.get(code)?.label ?? code;
  let text = `${ev.action.toLowerCase()} on ${String(ev.entity_type).replace(/^academy_/, '').replace(/_/g, ' ')}`;

  switch (ev.entity_type) {
    case 'academy_fee_periods': {
      const p = row?.learner_id !== undefined ? row : L.periods.get(ev.entity_id);
      if (ev.action === 'CHANGE_AMOUNT') { text = `Changed the fee for ${periodOwner(L.periods.get(ev.entity_id))} from ${money(d.from)} to ${money(d.to)}${d.reason ? `: "${d.reason}"` : ''}`; break; }
      if (ev.action === 'INSERT') { text = `Started 3 months for ${periodOwner(p)} (${fmt(p.period_start)} – ${fmt(p.period_end)}, ${money(p.amount_due)})`; break; }
      if (ev.action === 'UPDATE' && before && after) {
        if (before.approved_status !== after.approved_status && after.approved_status !== 'unpaid') text = `Approved the payment of ${periodOwner(after)} as ${STATUS[after.approved_status] ?? after.approved_status}`;
        else if (before.checked_status !== after.checked_status && after.checked_status !== 'unpaid') text = `Checked the payment of ${periodOwner(after)}: ${STATUS[after.checked_status] ?? after.checked_status}`;
        else if (before.reported_status !== after.reported_status || before.paid_on !== after.paid_on || before.paid_method !== after.paid_method || before.paid_amount !== after.paid_amount) {
          text = after.reported_status === 'unpaid' ? `Cleared the payment report of ${periodOwner(after)}`
            : `Reported the payment of ${periodOwner(after)}: ${STATUS[after.reported_status] ?? after.reported_status}${after.paid_method ? ' via ' + method(after.paid_method) : ''}${after.paid_amount ? ', ' + money(after.paid_amount) : ''}${after.paid_on ? ' on ' + fmt(after.paid_on) : ''}`;
        } else if (before.approved_status !== after.approved_status || before.checked_status !== after.checked_status) text = `Reset the check or approval of ${periodOwner(after)}'s payment`;
        else text = `Updated the payment record of ${periodOwner(after)}`;
      }
      break;
    }
    case 'academy_attendance': {
      const s = L.sessions.get(row.session_id);
      const where = `${s ? cls(s.class_id) : 'a class'}${s ? ' on ' + fmt(new Date(s.starts_at).toISOString()) : ''}`;
      if (ev.action === 'UPDATE' && before && before.status !== after.status) text = `Changed ${child(after.learner_id)}'s mark to ${MARK[after.status] ?? after.status} (was ${MARK[before.status] ?? before.status}) in ${where}`;
      else text = `Marked ${child(row.learner_id)} ${MARK[row.status] ?? row.status} in ${where}`;
      break;
    }
    case 'academy_enrollments':
      text = ev.action === 'DELETE' ? `Removed ${child(row.learner_id)} from ${cls(row.class_id)}` : `Enrolled ${child(row.learner_id)} in ${cls(row.class_id)}`;
      break;
    case 'academy_guardian_links':
      if (ev.action === 'DELETE') text = `Unlinked ${parent(row.guardian_id)} from ${child(row.learner_id)}`;
      else if (ev.action === 'UPDATE' && before && !before.verified_by_staff_id && after.verified_by_staff_id) text = `Verified ${parent(after.guardian_id)} as parent of ${child(after.learner_id)}`;
      else if (ev.action === 'INSERT') text = `Added ${parent(row.guardian_id)} as parent of ${child(row.learner_id)}${row.verified_by_staff_id ? '' : ' (waiting for verification)'}`;
      else text = `Updated the link between ${parent(row.guardian_id)} and ${child(row.learner_id)}`;
      break;
    case 'academy_guardians':
      if (ev.action === 'SET_CONSENT') text = `Recorded contact permission for ${parent(ev.entity_id)}: WhatsApp ${d.whatsapp ? 'yes' : 'no'}, email ${d.email ? 'yes' : 'no'}`;
      break;
    case 'academy_staff':
      if (ev.action === 'INSERT') text = `Gave ${staffName(row)} the ${ROLE[row.role] ?? row.role} role`;
      else if (ev.action === 'UPDATE' && before && after) {
        if (before.role !== after.role) text = `Changed ${staffName(after)}'s role from ${ROLE[before.role] ?? before.role} to ${ROLE[after.role] ?? after.role}`;
        else if (before.active !== after.active) text = `Switched ${staffName(after)}'s access ${after.active ? 'on' : 'off'}`;
        else if (before.display_name !== after.display_name) text = `Renamed ${before.display_name ?? 'a staff member'} to ${after.display_name}`;
        else text = `Updated ${staffName(after)}`;
      }
      break;
    default:
  }
  return { id: ev.id, at: ev.created_at, who, category: CATEGORY[ev.entity_type] ?? 'Other', text };
}

/** "Today", "Yesterday" or a date, for grouping the list. */
export function dayLabel(iso, now = new Date()) {
  const day = d => { const x = new Date(d); return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate(); };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (day(iso) === day(now)) return 'Today';
  if (day(iso) === day(y)) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
