/** Demonstration-only helpers. No account or money backend. */
/** @param {Record<string,'Present'|'Absent'|'Late'>} register @param {string} id @param {'Present'|'Absent'|'Late'} status */
export function markAttendance(register,id,status){if(!Object.hasOwn(register,id))throw Error('Unknown sample learner');if(!['Present','Absent','Late'].includes(status))throw Error('Invalid status');return {...register,[id]:status};}
/** @param {number} due @param {number} paid @param {number} next */
export function recordDemoPayment(due,paid,next){if(![due,paid,next].every(Number.isSafeInteger)||due<=0||paid<0||next<=0)throw Error('Enter a positive whole ETB amount');if(paid>due||next>due-paid)throw Error('Amount exceeds remaining demo balance');return paid+next;}
/** @param {'Not submitted'|'Submitted'|'Reviewed'} current */
export function nextSubmissionState(current){if(current==='Not submitted')return 'Submitted';if(current==='Submitted'||current==='Reviewed')return 'Reviewed';throw Error('Invalid task state');}
