import {useState,type FormEvent} from 'react';
import {recordDemoPayment} from '../lib/learning.mjs';
import type {SampleFee} from './AcademyFeePlan';
type Entry={kind:'payment';student:string;period:string;previous:number;next:number;delta:number;receiptNo:string};
type Receipt={receiptNo:string;student:string;guardian:string;period:string;amount:number;before:number;after:number;due:number};
type Props={ledger:SampleFee[];invoice:number;onInvoiceChange:(index:number)=>void;amount:string;onAmountChange:(amount:string)=>void;
 feedback:string;onFeedbackChange:(message:string)=>void;nextSequence:number;onUpdate:(next:SampleFee[])=>void;onPayment:(entry:Entry)=>void};
const price=(n:number)=>'ETB '+n.toLocaleString('en-US');
export default function AcademyPaymentRecorder({ledger,invoice,onInvoiceChange,amount,onAmountChange,feedback,onFeedbackChange,nextSequence,onUpdate,onPayment}:Props){
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const row=ledger[invoice];
  if(!row){onFeedbackChange('Choose an existing fictional fee row');return;}
  try{
   const nextRecorded=recordDemoPayment(row.due,row.recorded,Number(amount));
   const receiptNo='DEMO-RCP-'+String(nextSequence).padStart(4,'0');
   onUpdate(ledger.map((item,index)=>index===invoice?{...item,recorded:nextRecorded}:item));
   onPayment({kind:'payment',student:row.student,period:row.period,previous:row.recorded,next:nextRecorded,delta:Number(amount),receiptNo});
   setReceipt({receiptNo,student:row.student,guardian:row.guardian,period:row.period,amount:Number(amount),before:row.recorded,after:nextRecorded,due:row.due});
   onFeedbackChange('Updated the fictional ledger for '+row.student+'. No actual payment was processed.');
   onAmountChange('');
  }catch(error){onFeedbackChange(error instanceof Error?error.message:'Invalid sample amount');}
 }
 return <>
  <form className="demo-form" onSubmit={submit}>
   <h3>Record an external sample payment</h3>
   <p>Use only after an imaginary payment is said to have happened outside this demo.</p>
   <label>Sample fee row<select value={invoice} onChange={e=>{onInvoiceChange(Number(e.target.value));onFeedbackChange('');}}>
    {ledger.map((item,i)=><option key={item.learnerId+'-'+item.period} value={i}>
     {item.student} · {item.period} · {price(Math.max(0,item.due-item.recorded))} remaining
    </option>)}
   </select></label>
   <label>ETB amount<input type="number" min="1" step="1" placeholder="500" value={amount} onChange={e=>onAmountChange(e.target.value)}/></label>
   <button className="primary-btn" type="submit">Record sample only</button>
   <p className="form-feedback" role="status" aria-live="polite">{feedback}</p>
  </form>
  {receipt&&<section className="sample-receipt panel" aria-label="Fictional sample receipt">
   <span className="eyebrow">DEMO RECEIPT · NOT VALID PROOF OF PAYMENT</span>
   <h2>BigChange Academy</h2><p>Sample external payment record</p>
   <dl><div><dt>Receipt reference</dt><dd>{receipt.receiptNo}</dd></div>
    <div><dt>Fictional student</dt><dd>{receipt.student}</dd></div>
    <div><dt>Fictional guardian</dt><dd>{receipt.guardian}</dd></div>
    <div><dt>Fee period</dt><dd>{receipt.period}</dd></div>
    <div><dt>Sample amount recorded</dt><dd>{price(receipt.amount)}</dd></div>
    <div><dt>Balance before</dt><dd>{price(Math.max(0,receipt.due-receipt.before))}</dd></div>
    <div><dt>Balance after</dt><dd>{price(Math.max(0,receipt.due-receipt.after))}</dd></div>
   </dl>
   <p className="quiet">This printable demonstration is not an official receipt, transaction confirmation, or proof that money changed hands.</p>
   <div className="receipt-actions"><button className="primary-btn" type="button" onClick={()=>window.print()}>Print sample receipt</button>
    <button className="small-btn" type="button" onClick={()=>setReceipt(null)}>Dismiss</button></div>
  </section>}
 </>;
}
