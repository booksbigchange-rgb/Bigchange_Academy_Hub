import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLookups, describeEvent, dayLabel } from '../src/live/activity.mjs';

const data = {
  learners: [{ id: 'a', display_name: 'Abel' }], classes: [{ id: 'k1', title: 'English – Level 2' }],
  sessions: [{ id: 's1', class_id: 'k1', starts_at: '2026-11-18T13:00:00.000Z' }],
  guardians: [{ id: 'g1', display_name: 'Parent One' }],
  periods: [{ id: 'p1', learner_id: 'a', guardian_id: 'g1' }],
  staff: [{ id: 'st1', auth_user_id: 'u1', display_name: 'Admin Person', role: 'admin' }, { id: 'st2', auth_user_id: 'u2', display_name: 'Teacher Two', role: 'teacher' }],
  paymentMethods: [{ code: 'ria_tsegay', label: 'Ria – Tsegay' }],
};
const L = activityLookups(data);
const ev = (o) => ({ id: 1, created_at: '2026-11-24T10:00:00Z', actor_id: 'u1', entity_id: null, detail: {}, ...o });
const period = { learner_id: 'a', guardian_id: 'g1', reported_status: 'unpaid', checked_status: 'unpaid', approved_status: 'unpaid', paid_on: null, paid_method: null, paid_amount: null };

test('payments: start, report, check, approve, amount change', () => {
  assert.equal(describeEvent(ev({ action: 'INSERT', entity_type: 'academy_fee_periods', detail: { ...period, period_start: '2026-11-01', period_end: '2027-02-01', amount_due: 150 } }), L).text,
    'Started 3 months for Abel (01/11/2026 – 01/02/2027, USD 150)');
  const reported = { ...period, reported_status: 'paid', paid_on: '2026-11-20', paid_method: 'ria_tsegay', paid_amount: 150 };
  const r = describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_fee_periods', actor_id: 'u2', detail: { before: period, after: reported } }), L);
  assert.deepEqual([r.who, r.category, r.text], ['Teacher Two', 'Payments', 'Reported the payment of Abel: Paid via Ria – Tsegay, USD 150 on 20/11/2026']);
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_fee_periods', detail: { before: reported, after: { ...reported, checked_status: 'paid' } } }), L).text, 'Checked the payment of Abel: Paid');
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_fee_periods', detail: { before: { ...reported, checked_status: 'paid' }, after: { ...reported, checked_status: 'paid', approved_status: 'paid' } } }), L).text, 'Approved the payment of Abel as Paid');
  assert.equal(describeEvent(ev({ action: 'CHANGE_AMOUNT', entity_type: 'academy_fee_periods', entity_id: 'p1', detail: { from: 150, to: 120, reason: 'Sister joined' } }), L).text,
    'Changed the fee for Abel from USD 150 to USD 120: "Sister joined"');
});
test('attendance, classes, parents, staff', () => {
  assert.equal(describeEvent(ev({ action: 'INSERT', entity_type: 'academy_attendance', detail: { session_id: 's1', learner_id: 'a', status: 'present' } }), L).text, 'Marked Abel Present in English – Level 2 on 18/11/2026');
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_attendance', detail: { before: { session_id: 's1', learner_id: 'a', status: 'absent' }, after: { session_id: 's1', learner_id: 'a', status: 'late' } } }), L).text,
    "Changed Abel's mark to Late (was Absent) in English – Level 2 on 18/11/2026");
  assert.equal(describeEvent(ev({ action: 'DELETE', entity_type: 'academy_enrollments', detail: { class_id: 'k1', learner_id: 'a' } }), L).text, 'Removed Abel from English – Level 2');
  assert.equal(describeEvent(ev({ action: 'INSERT', entity_type: 'academy_guardian_links', detail: { guardian_id: 'g1', learner_id: 'a', verified_by_staff_id: null } }), L).text, 'Added Parent One as parent of Abel (waiting for verification)');
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_guardian_links', detail: { before: { guardian_id: 'g1', learner_id: 'a', verified_by_staff_id: null }, after: { guardian_id: 'g1', learner_id: 'a', verified_by_staff_id: 'st1' } } }), L).text, 'Verified Parent One as parent of Abel');
  assert.equal(describeEvent(ev({ action: 'SET_CONSENT', entity_type: 'academy_guardians', entity_id: 'g1', detail: { whatsapp: true, email: false } }), L).text, 'Recorded contact permission for Parent One: WhatsApp yes, email no');
  const staff = { id: 'st2', display_name: 'Teacher Two', role: 'teacher', active: true };
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_staff', detail: { before: staff, after: { ...staff, active: false } } }), L).text, "Switched Teacher Two's access off");
  assert.equal(describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_staff', detail: { before: staff, after: { ...staff, role: 'finance' } } }), L).text, "Changed Teacher Two's role from Teacher to Finance");
});
test('who: unknown and missing actors; unknown tables fall back', () => {
  assert.equal(describeEvent(ev({ actor_id: 'u9', action: 'INSERT', entity_type: 'academy_enrollments', detail: { class_id: 'k1', learner_id: 'a' } }), L).who, 'A former staff account');
  assert.equal(describeEvent(ev({ actor_id: null, action: 'INSERT', entity_type: 'academy_enrollments', detail: { class_id: 'k1', learner_id: 'a' } }), L).who, 'System');
  const o = describeEvent(ev({ action: 'UPDATE', entity_type: 'academy_external_payments', detail: {} }), L);
  assert.deepEqual([o.category, o.text], ['Payments', 'update on external payments']);
});
test('dayLabel', () => {
  const now = new Date(2026, 10, 24, 12);
  assert.equal(dayLabel(new Date(2026, 10, 24, 8).toISOString(), now), 'Today');
  assert.equal(dayLabel(new Date(2026, 10, 23, 20).toISOString(), now), 'Yesterday');
  assert.match(dayLabel(new Date(2026, 10, 20, 9).toISOString(), now), /20 November 2026/);
});
