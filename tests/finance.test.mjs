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
import { feeStatus, normalizeFeePeriod, reminderText } from '../src/lib/finance.mjs';
test('overdue applies only to unpaid or partial fees from past months', () => {
  const today = new Date(2026, 10, 5);
  assert.equal(feeStatus({ due: 100, recorded: 0, period: '2026-10' }, today), 'Overdue');
  assert.equal(feeStatus({ due: 100, recorded: 40, period: 'October 2026' }, today), 'Overdue');
  assert.equal(feeStatus({ due: 100, recorded: 0, period: '2026-11' }, today), 'Unpaid');
  assert.equal(feeStatus({ due: 100, recorded: 100, period: '2026-01' }, today), 'Paid');
  assert.equal(normalizeFeePeriod('bogus'), null);
});
test('reminder text states the remaining balance and is not a send', () => {
  const text = reminderText({ due: 2500, recorded: 1000, guardian: 'G', student: 'S', period: '2026-10' });
  assert.match(text, /ETB 1,500/);
});
