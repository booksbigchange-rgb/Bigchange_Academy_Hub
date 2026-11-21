import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatusCounts, studentsPerCourse, weeklyAttendance, attendanceRecent, attendanceCalendar, heatStep, donutSlices, mondayOf } from '../src/live/dashboard.mjs';

test('paymentStatusCounts: only each child\'s current (latest started) period counts; future periods are ignored', () => {
  const periods = [
    { learner_id: 'a', guardian_id: 'g', period_start: '2026-05-01', status: 'paid' },
    { learner_id: 'a', guardian_id: 'g', period_start: '2026-08-01', status: 'overdue' },   // current for a
    { learner_id: 'b', guardian_id: 'g', period_start: '2026-10-01', status: 'partial' },
    { learner_id: 'b', guardian_id: 'g', period_start: '2027-01-01', status: 'unpaid' },    // future: ignored
    { learner_id: null, guardian_id: 'h', period_start: '2026-09-01', status: 'paid' },     // old family-wide period
  ];
  assert.deepEqual(paymentStatusCounts(periods, '2026-11-21'), { paid: 1, partial: 1, unpaid: 0, overdue: 1, total: 3 });
});

test('studentsPerCourse: a student counts once per course, inactive students not at all; extra courses fold into Other', () => {
  const data = {
    learners: [{ id: 'a', active: true }, { id: 'b', active: true }, { id: 'c', active: false }],
    courses: [{ id: 'en', title: 'English' }, { id: 'cs', title: 'Computer' }],
    classes: [{ id: 'k1', course_id: 'en' }, { id: 'k2', course_id: 'en' }, { id: 'k3', course_id: 'cs' }],
    enrollments: [{ class_id: 'k1', learner_id: 'a' }, { class_id: 'k2', learner_id: 'a' }, { class_id: 'k1', learner_id: 'b' },
      { class_id: 'k3', learner_id: 'b' }, { class_id: 'k3', learner_id: 'c' }],
  };
  assert.deepEqual(studentsPerCourse(data), [{ label: 'English', count: 2 }, { label: 'Computer', count: 1 }]);
  assert.deepEqual(studentsPerCourse(data, 1), [{ label: 'Other courses', count: 3 }]);
});

const at = (y, m, d, h = 16) => new Date(y, m - 1, d, h, 0).toISOString();
const data = {
  sessions: [{ id: 's1', starts_at: at(2026, 11, 16) }, { id: 's2', starts_at: at(2026, 11, 18) }, { id: 's3', starts_at: at(2026, 11, 10) }],
  attendance: [
    { session_id: 's1', status: 'present' }, { session_id: 's1', status: 'absent' }, { session_id: 's1', status: 'excused' },
    { session_id: 's2', status: 'present' }, { session_id: 's2', status: 'late' },
    { session_id: 's3', status: 'absent' }, { session_id: 's3', status: 'present' }, { session_id: 's3', status: 'present' }, { session_id: 's3', status: 'absent' },
  ],
};
test('mondayOf: Monday of the week', () => {
  assert.equal(mondayOf('2026-11-21'), '2026-11-16'); // Saturday
  assert.equal(mondayOf('2026-11-16'), '2026-11-16');
  assert.equal(mondayOf('2026-11-22'), '2026-11-16'); // Sunday
});
test('weeklyAttendance: excused not counted; weeks without lessons are null', () => {
  const w = weeklyAttendance(data, '2026-11-21', 3);
  assert.deepEqual(w.map(x => [x.weekStart, x.rate]), [['2026-11-02', null], ['2026-11-09', 50], ['2026-11-16', 75]]);
});
test('attendanceRecent: this period and the one before', () => {
  assert.deepEqual(attendanceRecent(data, '2026-11-21', 7), { rate: 75, before: 50 });
});
test('attendanceCalendar: weeks of Monday-to-Sunday days with each day\'s rate', () => {
  const cal = attendanceCalendar(data, '2026-11-21', 2);
  assert.equal(cal.length, 2); assert.equal(cal[0].length, 7);
  assert.equal(cal[0][0].date, '2026-11-09');
  assert.equal(cal[0][1].rate, 50);                // Tue 10 Nov
  assert.equal(cal[1][0].rate, 50);                // Mon 16 Nov: present + absent (excused ignored)
  assert.equal(cal[1][2].rate, 100);               // Wed 18 Nov
  assert.equal(cal[1][3].rate, null);              // no lesson
  assert.equal(cal[1][6].future, true);            // Sun 22 Nov is after today
});
test('heatStep: light to dark by rate; no lesson is 0', () => {
  assert.deepEqual([null, 70, 80, 85, 90, 95, 100].map(heatStep), [0, 1, 2, 3, 4, 5, 5]);
});
test('donutSlices: proportional slices with a gap, starting where the previous ended', () => {
  const s = donutSlices([1, 1, 2], 100, 2);
  assert.deepEqual(s.map(x => [x.dash, x.offset]), [[23, -0], [23, -25], [48, -50]]);
  assert.deepEqual(donutSlices([0, 0], 100), []);
  assert.deepEqual(donutSlices([5, 0], 100).map(x => x.dash), [100, 0]); // a single slice has no gap
});
