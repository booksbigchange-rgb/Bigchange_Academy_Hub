import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatus, outstandingBalance } from '../src/lib/finance.mjs';

test('external payment statuses are calculated correctly', () => {
  assert.equal(paymentStatus(2500, 2500), 'Paid');
  assert.equal(paymentStatus(2500, 1000), 'Partial');
  assert.equal(paymentStatus(2500, 0), 'Unpaid');
  assert.equal(paymentStatus(2500, 3000), 'Paid');
});
test('unpaid balance never goes negative', () => {
  assert.equal(outstandingBalance(2500 - 1000), 1500);
  assert.equal(outstandingBalance(2500 - 3000), 0);
});
test('invalid amounts are rejected', () => {
  assert.throws(() => paymentStatus(-1, 0));
  assert.throws(() => paymentStatus(NaN, 0));
});
