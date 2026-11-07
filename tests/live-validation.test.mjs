import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLearner, validateCourse, validateClass, matchesSearch, enrollmentProblem } from '../src/live/validation.mjs';
test('learner validation trims, bounds and maps to database columns', () => {
  assert.deepEqual(validateLearner({ name: '  Sample   Kid ', gradeLevel: 'Grade 7', note: ' hi ' }),
    { display_name: 'Sample Kid', grade_level: 'Grade 7', note: 'hi' });
  assert.deepEqual(validateLearner({ name: 'Ab' }), { display_name: 'Ab', grade_level: null, note: null });
  assert.throws(() => validateLearner({ name: 'A' }), /name/);
  assert.throws(() => validateLearner({ name: 'x'.repeat(81) }), /name/);
  assert.throws(() => validateLearner({ name: '<b>x</b>' }), /cannot contain/);
  assert.throws(() => validateLearner({ name: 'Ok', gradeLevel: 'Grade 99' }), /grade/);
  assert.throws(() => validateLearner({ name: 'Ok', note: 'n'.repeat(121) }), /120/);
});
test('course and class validation', () => {
  assert.deepEqual(validateCourse({ title: ' Robotics ' }), { title: 'Robotics', description: null });
  assert.throws(() => validateCourse({ title: '' }), /title/);
  assert.deepEqual(validateClass({ title: 'Mon', courseId: 'c1' }), { title: 'Mon', course_id: 'c1', teacher_staff_id: null });
  assert.throws(() => validateClass({ title: 'Mon', courseId: '' }), /course/i);
});
test('search and enrollment guards', () => {
  assert.ok(matchesSearch('Sample Learner', ' LEARN '));
  assert.ok(!matchesSearch('Sample', 'zzz'));
  const learners = [{ id: 'l1', active: true }, { id: 'l2', active: false }];
  const enrollments = [{ class_id: 'c1', learner_id: 'l1' }];
  assert.match(enrollmentProblem({ learnerId: 'l1', classId: 'c1', enrollments, learners }), /Already/);
  assert.match(enrollmentProblem({ learnerId: 'l2', classId: 'c1', enrollments, learners }), /inactive/);
  assert.match(enrollmentProblem({ learnerId: 'zz', classId: 'c1', enrollments, learners }), /Choose a student/);
  assert.equal(enrollmentProblem({ learnerId: 'l1', classId: 'c2', enrollments, learners }), '');
});
import { validateSession, duplicateSession, attendanceSummary, localDay } from '../src/live/validation.mjs';
test('lesson date and time validation', () => {
  assert.match(validateSession({ date: '2026-11-10', time: '16:00' }), /^2026-11-1\d/);
  assert.throws(() => validateSession({ date: '2026-02-30', time: '16:00' }), /valid date/);
  assert.throws(() => validateSession({ date: '', time: '16:00' }), /date/);
  assert.throws(() => validateSession({ date: '2026-11-10', time: '25:00' }), /time/);
  assert.throws(() => validateSession({ date: '1999-01-01', time: '10:00' }), /2020/);
});
test('duplicate lesson detection is per class and local day', () => {
  const iso = new Date('2026-11-10T16:00').toISOString();
  const sessions = [{ id: 's1', class_id: 'c1', starts_at: iso }];
  assert.equal(localDay(iso), '2026-11-10');
  assert.ok(duplicateSession(sessions, 'c1', '2026-11-10'));
  assert.ok(!duplicateSession(sessions, 'c2', '2026-11-10'));
  assert.ok(!duplicateSession(sessions, 'c1', '2026-11-11'));
});
test('attendance summary excludes excused from the rate', () => {
  const s = attendanceSummary([{ status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'excused' }, { status: 'present' }]);
  assert.deepEqual([s.present, s.late, s.absent, s.excused, s.marked, s.rate], [2, 1, 1, 1, 4, 75]);
  assert.equal(attendanceSummary([]).rate, null);
  assert.equal(attendanceSummary([{ status: 'excused' }]).rate, null);
});
import { studentHistory, parentDirectory } from '../src/live/validation.mjs';
test('student attendance history is newest first with a summary', () => {
  const sessions = [{ id: 's1', class_id: 'c1', starts_at: '2026-11-02T13:00:00.000Z' }, { id: 's2', class_id: 'c1', starts_at: '2026-11-04T13:00:00.000Z' }, { id: 's3', class_id: 'c2', starts_at: '2026-11-03T13:00:00.000Z' }];
  const attendance = [{ session_id: 's1', learner_id: 'k', status: 'present' }, { session_id: 's2', learner_id: 'k', status: 'absent' }, { session_id: 's3', learner_id: 'other', status: 'late' }, { session_id: 'gone', learner_id: 'k', status: 'late' }];
  const h = studentHistory('k', { attendance, sessions, classes: [{ id: 'c1', title: 'Maths 1' }] });
  assert.deepEqual(h.rows.map(r => r.status), ['absent', 'present']);
  assert.equal(h.rows[0].classTitle, 'Maths 1');
  assert.equal(h.summary.rate, 50);
  assert.equal(studentHistory('none', { attendance, sessions, classes: [] }).rows.length, 0);
});
test('parent directory groups verified and pending children and searches', () => {
  const guardians = [{ id: 'g1', display_name: 'Almaz', phone_e164: '+251911', email: null }, { id: 'g2', display_name: 'Bereket', phone_e164: null, email: 'b@x.et' }];
  const links = [{ guardian_id: 'g1', learner_id: 'k1', verified: true }, { guardian_id: 'g1', learner_id: 'k2', verified: false }];
  const learners = [{ id: 'k1', display_name: 'Kid One' }, { id: 'k2', display_name: 'Kid Two' }];
  const d = parentDirectory({ guardians, links, learners });
  assert.deepEqual(d[0].verified.map(c => c.name), ['Kid One']);
  assert.deepEqual(d[0].pending.map(c => c.name), ['Kid Two']);
  assert.equal(d[1].verified.length + d[1].pending.length, 0);
  assert.deepEqual(parentDirectory({ guardians, links, learners }, 'kid two').map(g => g.id), ['g1']);
  assert.deepEqual(parentDirectory({ guardians, links, learners }, 'B@X').map(g => g.id), ['g2']);
});
