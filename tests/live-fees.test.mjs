import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEE_RATES, planQuarterFees, quarterLabel, quarterStart, quarterOptions } from '../src/live/fees.mjs';
import { normalizePhone, validateGuardian } from '../src/live/validation.mjs';

test('quarters start in Jan/Apr/Jul/Oct and are labelled', () => {
  assert.equal(quarterStart(new Date(2026, 10, 6)), '2026-10');
  assert.equal(quarterStart(new Date(2026, 0, 1)), '2026-01');
  assert.equal(quarterStart(new Date(2026, 5, 30)), '2026-04');
  assert.equal(quarterLabel('2026-07'), '2026 Q3');
  assert.throws(() => quarterLabel('2026-02'), /Invalid/);
  assert.ok(quarterOptions(new Date(2026, 10, 6)).includes('2026-10'));
});

const classes = [{ id: 'cA', course_id: 'c1' }, { id: 'cB', course_id: 'c2' }, { id: 'cC', course_id: 'c1' }];
const learners = [{ id: 'k1', active: true }, { id: 'k2', active: true }, { id: 'k3', active: true }, { id: 'k4', active: false }];
const v = (l, g) => ({ learner_id: l, guardian_id: g, verified: true });
const base = { period: '2026-10', learners, classes, existing: [] };

test('one child in one course pays 150', () => {
  const p = planQuarterFees({ ...base, links: [v('k1', 'g1')], enrollments: [{ class_id: 'cA', learner_id: 'k1' }] });
  assert.deepEqual(p.toCreate.map(r => r.amount_due), [150]);
  assert.equal(p.total, FEE_RATES.single);
});
test('one child in two courses pays 100 per course', () => {
  const p = planQuarterFees({ ...base, links: [v('k1', 'g1')], enrollments: [{ class_id: 'cA', learner_id: 'k1' }, { class_id: 'cB', learner_id: 'k1' }] });
  assert.deepEqual(p.toCreate.map(r => r.amount_due), [100, 100]);
});
test('two children, one course each, same parent: 100 each', () => {
  const p = planQuarterFees({ ...base, links: [v('k1', 'g1'), v('k2', 'g1')], enrollments: [{ class_id: 'cA', learner_id: 'k1' }, { class_id: 'cA', learner_id: 'k2' }] });
  assert.deepEqual(p.toCreate.map(r => r.amount_due), [100, 100]);
});
test('separate families are priced separately', () => {
  const p = planQuarterFees({ ...base, links: [v('k1', 'g1'), v('k2', 'g2')], enrollments: [{ class_id: 'cA', learner_id: 'k1' }, { class_id: 'cA', learner_id: 'k2' }] });
  assert.deepEqual(p.toCreate.map(r => r.amount_due), [150, 150]);
});
test('two classes of the same course count once; inactive and unverified are skipped; existing fees are not repeated', () => {
  const enrollments = [{ class_id: 'cA', learner_id: 'k1' }, { class_id: 'cC', learner_id: 'k1' }, { class_id: 'cA', learner_id: 'k4' }, { class_id: 'cA', learner_id: 'k3' }];
  const links = [v('k1', 'g1'), v('k4', 'g4'), { learner_id: 'k3', guardian_id: 'g3', verified: false }];
  const p = planQuarterFees({ ...base, links, enrollments });
  assert.equal(p.toCreate.length, 1);
  assert.deepEqual(p.skippedNoGuardian, ['k3']);
  const again = planQuarterFees({ ...base, links, enrollments, existing: [{ learner_id: 'k1', course_id: 'c1', period: '2026-10' }] });
  assert.equal(again.toCreate.length, 0);
  assert.equal(again.alreadyExist.length, 1);
  const other = planQuarterFees({ ...base, links, enrollments, existing: [{ learner_id: 'k1', course_id: 'c1', period: '2026-07' }] });
  assert.equal(other.toCreate.length, 1);
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
  assert.match(code, /Only an administrator can approve payment status/);
  assert.doesNotMatch(code, /user_metadata|service_role|using\s*\(\s*true\s*\)/i);
  assert.match(code, /security_invoker = true/);
});
