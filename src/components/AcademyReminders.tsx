import {useState} from 'react';
import {feeStatus,reminderText} from '../lib/finance.mjs';
import type {SampleFee} from './AcademyFeePlan';
export default function AcademyReminders({ledger}:{ledger:SampleFee[]}){
 const [note,setNote]=useState('');
 const due=ledger.filter(r=>{const s=feeStatus(r);return s==='Overdue'||s==='Unpaid'||s==='Partial';});
 async function copy(row:SampleFee){
  try{await navigator.clipboard.writeText(reminderText(row));setNote('Reminder text for '+row.student+' copied. Nothing was sent.');}
  catch{setNote('Copy was blocked by the browser. Nothing was sent.');}
 }
 return <section className="panel" aria-label="Payment reminders">
  <span className="eyebrow">PARENT REMINDERS · MANUAL ONLY</span>
  <h3>Reminder queue</h3>
  <p className="quiet">Email and WhatsApp sending is not connected. It needs a messaging provider and recorded parent consent. Copy the text and send it yourself.</p>
  {due.length===0?<p className="quiet">No outstanding fees to remind about.</p>:
  <div className="table-wrap"><table><thead><tr><th>Student</th><th>Guardian</th><th>Period</th><th>Status</th><th>Delivery</th><th>Action</th></tr></thead><tbody>
   {due.map(r=><tr key={r.learnerId+'-'+r.period}><td>{r.student}</td><td>{r.guardian}</td><td>{r.period}</td>
    <td><span className={'tag '+(feeStatus(r)==='Overdue'?'red':'amber')}>{feeStatus(r)}</span></td>
    <td>Not sent · no integration</td>
    <td><button className="small-btn" type="button" onClick={()=>copy(r)}>Copy reminder text</button></td></tr>)}
  </tbody></table></div>}
  <p className="ops-feedback" role="status" aria-live="polite">{note}</p>
 </section>;
}
