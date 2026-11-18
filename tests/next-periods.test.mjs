import test from 'node:test';
import assert from 'node:assert/strict';
import { periodsToStart, attendanceCsvRows, ATTENDANCE_CSV_HEADER, toCsv } from '../src/live/fees.mjs';

const L = (id, name, active = true) => ({ id, display_name: name, active });
const base = {
  learners: [L('a', 'Abel'), L('b', 'Bethel'), L('c', 'Caleb'), L('d', 'Dawit'), L('e', 'Eden', false), L('f', 'Feven'), L('g', 'Gelila')],
  links: ['a', 'b', 'c', 'd', 'e', 'g'].map(id => ({ learner_id: id, guardian_id: 'p' + id, verified: true })).concat([{ learner_id: 'f', guardian_id: 'pf', verified: false }]),
  enrollments: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ class_id: 'k', learner_id: id })),
  periods: [
    { learner_id: 'a', period_start: '2026-05-01', period_end: '2026-08-01' },
    { learner_id: 'a', period_start: '2026-08-01', period_end: '2026-11-01' },   // Abel: ended 17 days ago
    { learner_id: 'b', period_start: '2026-09-01', period_end: '2026-11-25' },   // Bethel: ends in 7 days
    { learner_id: 'c', period_start: '2026-10-01', period_end: '2027-01-01' },   // Caleb: covered
    { learner_id: null, period_start: '2026-01-01', period_end: '2026-04-01' },  // old family-wide period: ignored
  ],
};
test('periodsToStart: ended first, then ending soon, then never started; covered children are left out', () => {
  const r = periodsToStart(base, '2026-11-18');
  assert.deepEqual(r.map(x => [x.name, x.reason, x.start]), [['Abel', 'ended', '2026-11-01'], ['Bethel', 'soon', '2026-11-25'], ['Dawit', 'never', '2026-11-18']]);
  assert.equal(r[0].lastEnd, '2026-11-01'); assert.equal(r[0].days, -17); assert.equal(r[2].lastEnd, null);
});
test('periodsToStart: inactive, unverified-parent and not-enrolled children are not listed', () => {
  const names = periodsToStart(base, '2026-11-18').map(x => x.name);
  for (const n of ['Eden', 'Feven', 'Gelila']) assert.ok(!names.includes(n), n);
});
test('periodsToStart: a period ending today counts as ended; the look-ahead window is adjustable', () => {
  assert.equal(periodsToStart(base, '2026-11-25').find(x => x.name === 'Bethel').reason, 'ended');
  assert.equal(periodsToStart(base, '2026-11-18', 3).some(x => x.name === 'Bethel'), false);
});

const atData = {
  classes: [{ id: 'k1', title: 'English – Level 2' }, { id: 'k2', title: 'Computer – Canva' }],
  learners: [L('a', 'Abel'), L('b', 'Bethel')],
  sessions: [{ id: 's1', class_id: 'k1', starts_at: new Date(2026, 10, 2, 16, 0).toISOString() },
    { id: 's2', class_id: 'k2', starts_at: new Date(2026, 10, 3, 9, 30).toISOString() },
    { id: 's3', class_id: 'k1', starts_at: new Date(2026, 10, 9, 16, 0).toISOString() }],
  attendance: [{ session_id: 's3', learner_id: 'a', status: 'late' }, { session_id: 's1', learner_id: 'b', status: 'absent' },
    { session_id: 's1', learner_id: 'a', status: 'present' }, { session_id: 's2', learner_id: 'b', status: 'excused' }],
};
test('attendanceCsvRows: all rows, sorted by date, class and student, with readable status', () => {
  assert.deepEqual(attendanceCsvRows(atData), [
    ['2026-11-02', '16:00', 'English – Level 2', 'Abel', 'Present'], ['2026-11-02', '16:00', 'English – Level 2', 'Bethel', 'Absent'],
    ['2026-11-03', '09:30', 'Computer – Canva', 'Bethel', 'Excused'], ['2026-11-09', '16:00', 'English – Level 2', 'Abel', 'Late']]);
});
test('attendanceCsvRows: class and date filters (inclusive)', () => {
  assert.equal(attendanceCsvRows(atData, { classId: 'k1' }).length, 3);
  assert.deepEqual(attendanceCsvRows(atData, { from: '2026-11-03', to: '2026-11-09' }).map(r => r[0]), ['2026-11-03', '2026-11-09']);
  assert.equal(attendanceCsvRows(atData, { classId: 'k2', from: '2026-11-04' }).length, 0);
});
test('attendance CSV has the header and opens as text', () => {
  const csv = toCsv(ATTENDANCE_CSV_HEADER, attendanceCsvRows(atData));
  assert.ok(csv.startsWith('﻿"Date","Time","Class","Student","Status"\r\n'));
});
