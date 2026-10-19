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

/**
 * Add an external fee obligation for a fictional learner only.
 * Uses a simulated guardian relationship; this is NOT proof of custody,
 * a payment request, or a validated accounting transaction.
 */
export function addDemoFeeObligation(ledger,{learnerId,guardianId,period,due},learners,guardians){
  const learner=learners.find(l=>l.id===learnerId&&l.active!==false);
  const guardian=guardians.find(g=>g.id===guardianId&&g.active!==false);
  if(!learner)throw Error('Choose an active fictional student');
  if(!guardian||!guardian.learnerIds.includes(learnerId))
    throw Error('Choose a fictional guardian linked to this student');
  if(typeof period!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))
    throw Error('Choose a valid Gregorian fee month');
  if(!Number.isSafeInteger(due)||due<1||due>1_000_000)
    throw Error('Fee must be a positive whole ETB amount up to 1,000,000');
  if(ledger.some(row=>row.learnerId===learnerId&&row.period===period))
    throw Error('A sample fee already exists for this student in that month');
  if(ledger.length>=3000)throw Error('Sample ledger row limit reached');
  return [...ledger,{
    learnerId,student:learner.name,guardianId,guardian:guardian.name,
    due,recorded:0,period
  }];
}
