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
