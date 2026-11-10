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
  const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const samePeriod=value=>{
    if(value===period)return true;
    const old=/^([A-Za-z]+) (20\d{2})$/.exec(value);
    return old&&old[2]===period.slice(0,4)&&names[Number(period.slice(5,7))-1]===old[1];
  };
  if(ledger.some(row=>row.learnerId===learnerId&&samePeriod(row.period)))
    throw Error('A sample fee already exists for this student in that month');
  if(ledger.length>=3000)throw Error('Sample ledger row limit reached');
  return [...ledger,{
    learnerId,student:learner.name,guardianId,guardian:guardian.name,
    due,recorded:0,period
  }];
}


/** Revise a fictional fee obligation without altering the amount already recorded externally. */
export function updateDemoFeeObligation(ledger,index,{period,due}){
 const row=ledger[index];
 if(!row)throw Error('Choose an existing fictional fee row');
 if(typeof period!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))
  throw Error('Choose a valid Gregorian fee month');
 if(!Number.isSafeInteger(due)||due<1||due>1_000_000)
  throw Error('Fee must be a positive whole ETB amount up to 1,000,000');
 if(due<row.recorded)throw Error('Expected fee cannot be lower than the amount already recorded');
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const samePeriod=value=>{
  if(value===period)return true;
  const old=/^([A-Za-z]+) (20\d{2})$/.exec(value);
  return Boolean(old&&old[2]===period.slice(0,4)&&months[Number(period.slice(5,7))-1]===old[1]);
 };
 if(ledger.some((item,i)=>i!==index&&item.learnerId===row.learnerId&&samePeriod(item.period)))
  throw Error('This student already has a sample fee for that month');
 if(due===row.due&&samePeriod(row.period))throw Error('Change the amount or month before saving');
 return ledger.map((item,i)=>i===index?{...item,due,period}:item);
}

const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Normalise a fee period ('2026-10' or legacy 'October 2026') to 'YYYY-MM', or null. */
export function normalizeFeePeriod(value){
  if(typeof value!=='string')return null;
  if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))return value;
  const old=/^([A-Za-z]+) (20\d{2})$/.exec(value);
  const index=old?MONTH_NAMES.indexOf(old[1]):-1;
  return old&&index>=0?old[2]+'-'+String(index+1).padStart(2,'0'):null;
}

/**
 * Tracking status for a fee row: Paid, Partial, Unpaid or Overdue.
 * Overdue = not fully paid and the fee month ended before the month of `today`
 * (a policy assumption: the school has not yet defined an exact due date).
 */
export function feeStatus(row,today=new Date()){
  const base=paymentStatus(row.due,row.recorded);
  if(base==='Paid')return base;
  const period=normalizeFeePeriod(row.period);
  const current=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  return period&&period<current?'Overdue':base;
}

/** Plain-text reminder for staff to send manually; this app never sends it. */
export function reminderText(row){
  const remaining=outstandingBalance(row.due-row.recorded);
  return `Dear ${row.guardian}, this is a reminder from BigChange Academy that ETB ${remaining.toLocaleString('en-US')} remains outstanding for ${row.student} (${row.period}). Payments are made outside this system. Please contact the school office if you have already paid.`;
}
