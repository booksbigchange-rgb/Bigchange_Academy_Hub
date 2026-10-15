/**
 * Pure, synthetic-data finance helpers. Real payments happen OUTSIDE this app.
 * @param {number} amountDue
 * @param {number} amountRecorded
 * @returns {'Paid'|'Partial'|'Unpaid'}
 */
export function paymentStatus(amountDue, amountRecorded) {
  if (!Number.isFinite(amountDue) || !Number.isFinite(amountRecorded) || amountDue < 0 || amountRecorded < 0) {
    throw new RangeError('Amounts must be finite and nonnegative');
  }
  if (amountRecorded >= amountDue) return 'Paid';
  if (amountRecorded > 0) return 'Partial';
  return 'Unpaid';
}

/** @param {number} amount */
export function outstandingBalance(amount) {
  if (!Number.isFinite(amount)) throw new TypeError('Amount must be finite');
  return Math.max(0, amount);
}
