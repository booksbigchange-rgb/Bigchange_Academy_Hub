import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatDate, usd, todayIso } from '../src/live/fees.mjs';
import { normalizePhone, validateGuardian, validateReport } from '../src/live/validation.mjs';

test('dates are shown day first and money in dollars', () => {
  assert.equal(formatDate('2026-08-10'), '10/08/2026');
  assert.equal(formatDate(null), '—');
  assert.equal(usd(150), 'USD 150');
  assert.equal(usd(1200.5), 'USD 1,200.5');
  assert.equal(todayIso(new Date(2026, 10, 7)), '2026-11-07');
});

test('payment report validation mirrors the database rules', () => {
  const today = '2026-11-07';
  assert.deepEqual(validateReport({ status: 'paid', paidOn: '2026-11-01', method: 'cash', note: ' ref 9 ' }, today, '2026-08-10'),
    { p_status: 'paid', p_paid_on: '2026-11-01', p_method: 'cash', p_note: 'ref 9' });
  assert.deepEqual(validateReport({ status: 'unpaid' }, today), { p_status: 'unpaid', p_paid_on: null, p_method: null, p_note: null });
  assert.throws(() => validateReport({ status: 'paid', method: 'cash' }, today), /date the parent paid/);
  assert.throws(() => validateReport({ status: 'paid', paidOn: '2026-11-08', method: 'cash' }, today), /future/);
  assert.throws(() => validateReport({ status: 'paid', paidOn: '2026-11-01' }, today), /how the parent paid/);
  assert.throws(() => validateReport({ status: 'paid', paidOn: '2026-06-01', method: 'bank' }, today, '2026-08-10'), /too far before/);
  assert.throws(() => validateReport({ status: 'partial', paidOn: '2026-11-01', method: 'wire' }, today), /how the parent paid/);
  assert.throws(() => validateReport({ status: 'weird' }, today), /unpaid, partly paid or paid/);
  assert.throws(() => validateReport({ status: 'paid', paidOn: '2026-11-01', method: 'cash', note: '<b>' }, today), /cannot contain/);
});

test('phone and guardian validation', () => {
  assert.equal(normalizePhone('0911 22 33 44'), '+251911223344');
  assert.equal(normalizePhone('+251 711-223344'), '+251711223344');
  assert.equal(normalizePhone('251911223344'), '+251911223344');
  assert.equal(normalizePhone(''), null);
  assert.throws(() => normalizePhone('0811223344'), /Enter the phone/);
  assert.throws(() => validateGuardian({ name: 'Ab' }), /phone number or an email/);
  assert.throws(() => validateGuardian({ name: 'Ab', email: 'bad' }), /valid email/);
  assert.throws(() => validateGuardian({ name: 'Ab', phone: '0911223344', emailOptIn: true }), /email address before/);
  assert.deepEqual(validateGuardian({ name: ' Abebe  K ', email: 'A@B.ET', phone: '0911223344', whatsappOptIn: true }),
    { p_name: 'Abebe K', p_email: 'a@b.et', p_phone: '+251911223344', p_email_opt: false, p_whatsapp_opt: true });
});

const sql = readFileSync(new URL('../supabase/migrations/20261107_0003_fees_and_guardians.sql', import.meta.url), 'utf8');
const code = sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
test('migration 0003 keeps functions locked down and approval admin-only', () => {
  const defs = code.split(/create or replace function/i).slice(1);
  assert.ok(defs.length >= 5);
  for (const d of defs) if (/security definer/i.test(d)) assert.match(d, /set search_path = ''/);
  assert.match(code, /revoke execute on function public\.academy_add_guardian[\s\S]*from public, anon;/);
  assert.match(code, /Only an administrator can approve a payment/);
  assert.match(code, /currency_code = 'USD'/);
  assert.match(code, /course_count integer not null check \(course_count >= 1\)/);
  assert.doesNotMatch(code, /create policy \w+ on public\.academy_fee_periods for (insert|delete)/);
  assert.doesNotMatch(code, /user_metadata|service_role|using\s*\(\s*true\s*\)/i);
  assert.match(code, /security_invoker = true/);
});

import { reminderText } from '../src/live/fees.mjs';
import { overviewCounts } from '../src/live/validation.mjs';
test('reminder text states amount, period and that payment is outside the system', () => {
  const t = reminderText({ guardian: 'Ms A', students: ['Kid One', 'Kid Two'], amount: 200, start: '2026-08-10', end: '2026-11-10' });
  assert.match(t, /USD 200/); assert.match(t, /10\/08\/2026 to 10\/11\/2026/); assert.match(t, /Kid One, Kid Two/); assert.match(t, /outside this system/);
  assert.match(reminderText({ guardian: 'G', students: [], amount: 150, start: '2026-01-01', end: '2026-04-01' }), /your child/);
});
test('overview counts', () => {
  const c = overviewCounts({
    learners: [{ active: true }, { active: false }], classes: [{ id: 'a', teacher_staff_id: null }, { id: 'b', teacher_staff_id: 's' }],
    guardians: [{}], links: [{ verified: false }, { verified: true }], enrollments: [{ class_id: 'b' }],
    periods: [{ status: 'overdue', stage: 'reported' }, { status: 'paid', stage: 'checked' }], teacherPeriods: [] });
  assert.deepEqual([c.activeStudents, c.inactiveStudents, c.classes, c.unassignedClasses, c.emptyClasses, c.pendingLinks, c.overdue, c.awaitingCheck, c.awaitingApproval], [1, 1, 2, 1, 1, 1, 1, 1, 1]);
  assert.equal(overviewCounts({ learners: [], classes: [], guardians: [], links: [], enrollments: [], periods: [], teacherPeriods: [{ status: 'overdue', stage: 'none' }] }).overdue, 1);
});

import { whatsappLink, needsReminder, remindedText } from '../src/live/fees.mjs';
test('WhatsApp link: digits only, message encoded, none without a number', () => {
  assert.equal(whatsappLink('+251911223344', 'Dear Ms A & family?'), 'https://wa.me/251911223344?text=Dear%20Ms%20A%20%26%20family%3F');
  assert.equal(whatsappLink(null, 'x'), null);
  assert.equal(whatsappLink('+12', 'x'), null);
});
test('reminders only after the 3 months end and while not paid', () => {
  assert.equal(needsReminder({ status: 'unpaid', period_end: '2026-11-01' }, '2026-11-09'), true);
  assert.equal(needsReminder({ status: 'overdue', period_end: '2026-10-01' }, '2026-11-09'), true);
  assert.equal(needsReminder({ status: 'paid', period_end: '2026-10-01' }, '2026-11-09'), false);
  assert.equal(needsReminder({ status: 'unpaid', period_end: '2026-12-01' }, '2026-11-09'), false);
  assert.equal(remindedText('2026-11-09T10:00:00Z'), 'Reminded 09/11/2026');
  assert.equal(remindedText(null), 'Not reminded yet');
});
