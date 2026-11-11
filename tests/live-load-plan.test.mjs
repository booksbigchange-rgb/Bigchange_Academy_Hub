import test from 'node:test';
import assert from 'node:assert/strict';
import { listsAfter, listsForRole, sectionsForRole } from '../src/live/loadPlan.mjs';

test('staff roles keep their screens; the first one opens after sign-in', () => {
  assert.equal(sectionsForRole('admin')[0], 'Overview');
  assert.ok(sectionsForRole('admin').includes('Courses'));
  assert.ok(!sectionsForRole('teacher').includes('Courses'));
  assert.equal(sectionsForRole('finance')[0], 'Fees');
});

test('parent and student sign-in is paused unless switched on', () => {
  assert.deepEqual(sectionsForRole('guardian'), []);
  assert.deepEqual(sectionsForRole('learner'), []);
  assert.deepEqual(sectionsForRole('guardian', true), ['My children', 'Payments']);
  assert.deepEqual(sectionsForRole('learner', true), ['My classes']);
  assert.deepEqual(sectionsForRole('unknown', true), []);
});

test('each role loads only the lists it is allowed to read', () => {
  assert.ok(listsForRole('admin').includes('staff'));
  assert.ok(!listsForRole('teacher').includes('guardians'));
  assert.ok(listsForRole('teacher').includes('teacherPeriods'));
  assert.ok(!listsForRole('finance').includes('staff'));
  assert.ok(listsForRole('guardian').includes('periods'));
  assert.ok(!listsForRole('learner').includes('periods'));
});

test('an attendance save reloads only lessons and marks; any other save leaves them alone', () => {
  assert.deepEqual(listsAfter('attendance', 'teacher'), ['sessions', 'attendance']);
  const records = listsAfter('records', 'admin');
  assert.ok(!records.includes('attendance') && !records.includes('sessions'));
  assert.ok(records.includes('learners') && records.includes('periods') && records.includes('staff'));
  assert.deepEqual(listsAfter('all', 'admin'), listsForRole('admin'));
  assert.deepEqual([...listsAfter('records', 'finance'), ...listsAfter('attendance', 'finance')].sort(), listsForRole('finance').sort());
});
