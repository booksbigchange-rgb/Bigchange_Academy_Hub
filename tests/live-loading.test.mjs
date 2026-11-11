import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_KEYS, TOUCHES, keysForRole } from '../src/live/loading.mjs';

test('each role loads only the lists it may read', () => {
  assert.ok(keysForRole('admin').includes('staff'));
  assert.ok(!keysForRole('finance').includes('staff'));
  assert.ok(keysForRole('teacher').includes('teacherPeriods'));
  assert.ok(!keysForRole('teacher').includes('guardians'));
  assert.ok(keysForRole('guardian').includes('periods'));
  assert.ok(!keysForRole('guardian').includes('links'));
  assert.deepEqual(keysForRole('learner').sort(), ['attendance', 'classes', 'courses', 'enrollments', 'learners', 'sessions']);
  for (const role of ['admin', 'teacher', 'finance']) assert.ok(!keysForRole(role).includes('attendance'), role + ' loads attendance per class, not all at once');
  assert.ok(keysForRole('guardian').includes('attendance'));
});

test('every save names real lists, and nothing a role cannot read is requested for it', () => {
  for (const [name, keys] of Object.entries(TOUCHES)) {
    assert.ok(keys.length > 0, name);
    for (const key of keys) assert.ok(ALL_KEYS.includes(key), name + ': ' + key);
  }
  assert.ok(TOUCHES.enrollment.length === 1 && TOUCHES.lesson.length === 1, 'small saves reload one list');
});
