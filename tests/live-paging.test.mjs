import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPages } from '../src/live/paging.mjs';

const source = n => Array.from({ length: n }, (_, i) => i);
const fake = (all, calls) => async (from, to) => { calls.push([from, to]); return { data: all.slice(from, to + 1), error: null }; };

test('reads past the 1,000-row server limit', async () => {
  const calls = []; const r = await collectPages(fake(source(2500), calls), 1000);
  assert.equal(r.rows.length, 2500); assert.equal(r.error, null);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});
test('exact multiple of the page size stops after one empty page', async () => {
  const calls = []; const r = await collectPages(fake(source(2000), calls), 1000);
  assert.equal(r.rows.length, 2000); assert.equal(calls.length, 3);
});
test('small and empty lists need one request', async () => {
  const calls = []; assert.equal((await collectPages(fake(source(3), calls))).rows.length, 3); assert.equal(calls.length, 1);
  assert.equal((await collectPages(fake([], []))).rows.length, 0);
});
test('an error stops reading and is reported', async () => {
  let n = 0; const r = await collectPages(async () => (++n === 2 ? { data: null, error: { message: 'x' } } : { data: source(10), error: null }), 10);
  assert.equal(r.error.message, 'x'); assert.equal(r.rows.length, 10);
});
