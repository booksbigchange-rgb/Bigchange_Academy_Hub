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

import { teacherStats, dataForTeacher } from '../src/live/dashboard.mjs';
test('teacherStats: only the teacher\'s classes; lessons per month; incomplete attendance in the last 30 days', () => {
  const T = 't1';
  const data = {
    learners: [{ id: 'a', active: true }, { id: 'b', active: true }, { id: 'c', active: false }, { id: 'd', active: true }],
    courses: [{ id: 'en', title: 'English' }],
    classes: [{ id: 'k1', title: 'English – Level 2', course_id: 'en', teacher_staff_id: T, level_end: '2026-12-01' },
      { id: 'k2', title: 'Other class', course_id: 'en', teacher_staff_id: 't2', level_end: null }],
    enrollments: [{ class_id: 'k1', learner_id: 'a' }, { class_id: 'k1', learner_id: 'b' }, { class_id: 'k1', learner_id: 'c' }, { class_id: 'k2', learner_id: 'd' }],
    sessions: [
      { id: 's1', class_id: 'k1', starts_at: new Date(2026, 10, 18, 16).toISOString() },  // this month, fully marked
      { id: 's2', class_id: 'k1', starts_at: new Date(2026, 10, 20, 16).toISOString() },  // this month, 1 of 2 marked
      { id: 's3', class_id: 'k1', starts_at: new Date(2026, 9, 5, 16).toISOString() },    // October (older than 30 days)
      { id: 's4', class_id: 'k1', starts_at: new Date(2026, 10, 30, 16).toISOString() },  // future: not counted as missing
      { id: 's9', class_id: 'k2', starts_at: new Date(2026, 10, 19, 16).toISOString() },  // another teacher
    ],
    attendance: [{ session_id: 's1', learner_id: 'a', status: 'present' }, { session_id: 's1', learner_id: 'b', status: 'late' },
      { session_id: 's2', learner_id: 'a', status: 'absent' }, { session_id: 's9', learner_id: 'd', status: 'present' }],
  };
  const s = teacherStats(data, T, new Date(2026, 10, 24, 12), 3);
  assert.deepEqual(s.classes.map(c => [c.title, c.course, c.students, c.rate, c.levelEnd]), [['English – Level 2', 'English', 2, 67, '2026-12-01']]);
  assert.equal(s.students, 2);                    // inactive student c not counted; other teacher's student d not counted
  assert.equal(s.lessonsThisMonth, 3);            // s1, s2, s4
  assert.deepEqual(s.monthly.map(m => [m.month, m.count]), [['2026-09', 0], ['2026-10', 1], ['2026-11', 3]]);
  assert.deepEqual(s.missing.map(m => [m.sessionId, m.marked, m.enrolled]), [['s2', 1, 2]]);
  assert.equal(s.rate, 67);
  assert.equal(dataForTeacher(data, T).attendance.length, 3);
});

import { studentStats, dataForLearner } from '../src/live/dashboard.mjs';
test('studentStats: classes with teacher and own attendance; payment periods newest first; current period; parents', () => {
  const data = {
    learners: [{ id: 'a', active: true }],
    courses: [{ id: 'en', title: 'English' }],
    staff: [{ id: 't1', display_name: 'Teacher One' }],
    classes: [{ id: 'k1', title: 'English – Level 2', course_id: 'en', teacher_staff_id: 't1', level_start: '2026-09-01', level_end: '2026-12-01' },
      { id: 'k2', title: 'Not hers', course_id: 'en', teacher_staff_id: null }],
    enrollments: [{ class_id: 'k1', learner_id: 'a' }, { class_id: 'k2', learner_id: 'z' }],
    sessions: [{ id: 's1', class_id: 'k1', starts_at: new Date(2026, 10, 18, 16).toISOString() }, { id: 's2', class_id: 'k1', starts_at: new Date(2026, 10, 20, 16).toISOString() }],
    attendance: [{ session_id: 's1', learner_id: 'a', status: 'present' }, { session_id: 's2', learner_id: 'a', status: 'absent' }, { session_id: 's2', learner_id: 'z', status: 'present' }],
    periods: [{ id: 'p1', learner_id: 'a', period_start: '2026-08-01', period_end: '2026-11-01', status: 'paid' },
      { id: 'p2', learner_id: 'a', period_start: '2026-11-01', period_end: '2027-02-01', status: 'unpaid' },
      { id: 'p3', learner_id: 'a', period_start: '2027-02-01', period_end: '2027-05-01', status: 'unpaid' },
      { id: 'px', learner_id: 'z', period_start: '2026-11-01', period_end: '2027-02-01', status: 'paid' }],
    guardians: [{ id: 'g1', display_name: 'Parent One', phone_e164: '+251911000000', email: null, whatsapp_opt_in: true, email_opt_in: false }],
    links: [{ learner_id: 'a', guardian_id: 'g1', verified: true }, { learner_id: 'z', guardian_id: 'g1', verified: true }],
  };
  const s = studentStats(data, 'a', '2026-11-24');
  assert.deepEqual(s.classes.map(c => [c.title, c.course, c.teacher, c.rate, c.lessons]), [['English – Level 2', 'English', 'Teacher One', 50, 2]]);
  assert.deepEqual(s.periods.map(p => p.id), ['p3', 'p2', 'p1']);
  assert.equal(s.current.id, 'p2');               // p3 has not started yet
  assert.equal(s.recent.rate, 50); assert.equal(s.marks, 2);
  assert.deepEqual(s.guardians.map(g => [g.name, g.phone, g.whatsapp, g.verified]), [['Parent One', '+251911000000', true, true]]);
  assert.equal(dataForLearner(data, 'a').attendance.length, 2);
});

import { lessonsByTeacher } from '../src/live/dashboard.mjs';
test('lessonsByTeacher: per current teacher for one month; held, complete, incomplete, upcoming; No teacher last', () => {
  const data = {
    learners: [{ id: 'a', active: true }, { id: 'b', active: true }, { id: 'c', active: false }],
    staff: [{ id: 't1', display_name: 'Teacher One' }, { id: 't2', display_name: 'Teacher Two' }],
    classes: [{ id: 'k1', title: 'English – Level 2', teacher_staff_id: 't1' }, { id: 'k2', title: 'Maths', teacher_staff_id: 't2' }, { id: 'k3', title: 'Orphan', teacher_staff_id: null }],
    enrollments: [{ class_id: 'k1', learner_id: 'a' }, { class_id: 'k1', learner_id: 'b' }, { class_id: 'k1', learner_id: 'c' }, { class_id: 'k2', learner_id: 'a' }],
    sessions: [
      { id: 's1', class_id: 'k1', starts_at: new Date(2026, 10, 3, 16).toISOString() },   // complete (2 of 2 active)
      { id: 's2', class_id: 'k1', starts_at: new Date(2026, 10, 10, 16).toISOString() },  // incomplete (1 of 2)
      { id: 's3', class_id: 'k1', starts_at: new Date(2026, 10, 28, 16).toISOString() },  // upcoming
      { id: 's4', class_id: 'k2', starts_at: new Date(2026, 10, 5, 9, 30).toISOString() },
      { id: 's5', class_id: 'k3', starts_at: new Date(2026, 10, 6, 9).toISOString() },    // no students enrolled: counts as complete
      { id: 's6', class_id: 'k1', starts_at: new Date(2026, 9, 30, 16).toISOString() },   // October: not this month
    ],
    attendance: [{ session_id: 's1', status: 'present' }, { session_id: 's1', status: 'absent' }, { session_id: 's2', status: 'late' }, { session_id: 's4', status: 'present' }],
  };
  const r = lessonsByTeacher(data, '2026-11', new Date(2026, 10, 24, 12));
  assert.deepEqual(r.rows.map(x => [x.teacher, x.classes, x.held, x.complete, x.incomplete, x.upcoming, x.rate]),
    [['Teacher One', 1, 2, 1, 1, 1, 67], ['Teacher Two', 1, 1, 1, 0, 0, 100], ['No teacher', 1, 1, 1, 0, 0, null]]);
  assert.deepEqual(r.total, { held: 4, complete: 3, incomplete: 1, upcoming: 1 });
  assert.deepEqual(r.lessons.map(l => [l.date, l.time, l.classTitle, l.marked, l.enrolled]).slice(0, 2), [['2026-11-03', '16:00', 'English – Level 2', 2, 2], ['2026-11-05', '09:30', 'Maths', 1, 1]]);
  assert.equal(r.lessons.length, 5);
});
