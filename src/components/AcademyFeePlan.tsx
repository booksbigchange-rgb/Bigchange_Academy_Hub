import {useState,type FormEvent} from 'react';
import {addDemoFeeObligation} from '../lib/finance.mjs';
import type {Person} from './AcademyOperations';
import type {Guardian} from './AcademyGuardianAdmin';
export type SampleFee={learnerId:string;student:string;guardianId:string;guardian:string;due:number;recorded:number;period:string};
type Props={learners:Person[];guardians:Guardian[];ledger:SampleFee[];onUpdate:(next:SampleFee[])=>void;onCreated:(index:number)=>void};
export default function AcademyFeePlan({learners,guardians,ledger,onUpdate,onCreated}:Props){
  const [learnerId,setLearnerId]=useState('');
  const [guardianId,setGuardianId]=useState('');
  const [period,setPeriod]=useState('2026-11');
  const [due,setDue]=useState('2500');
  const [message,setMessage]=useState('');
  const eligibleGuardians=guardians.filter(g=>g.active!==false&&g.learnerIds.includes(learnerId));
  function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      const next=addDemoFeeObligation(ledger,{learnerId,guardianId,period,due:Number(due)},learners,guardians);
      onUpdate(next);onCreated(next.length-1);
      setMessage('Created a fictional external-fee obligation. Nothing was charged or requested.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not create a sample obligation');}
  }
  return <section className="panel fee-obligation">
    <span className="eyebrow">ACADEMY FINANCE · SAMPLE FEE PLAN ONLY</span>
    <h2>Create a fictional fee obligation</h2>
    <p>Assign a simulated month and amount to a fictional learner with a linked sample guardian. No charge, receipt, invoice delivery or payment processing occurs.</p>
    <form className="ops-form" onSubmit={create}>
      <label>Fictional student<select required value={learnerId} onChange={e=>{setLearnerId(e.target.value);setGuardianId('');}}>
        <option value="">Choose active learner</option>{learners.filter(l=>l.active!==false).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
      </select></label>
      <label>Linked fictional guardian<select required value={guardianId} onChange={e=>setGuardianId(e.target.value)}>
        <option value="">Choose a linked guardian</option>{eligibleGuardians.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
      </select></label>
      <label>Fee month (Gregorian)<input type="month" required min="2026-01" max="2028-12" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
      <label>Expected amount (ETB)<input type="number" min="1" max="1000000" step="1" required value={due} onChange={e=>setDue(e.target.value)}/></label>
      {learnerId&&!eligibleGuardians.length&&<p className="quiet">No synthetic guardian link exists for this learner. Add one from Administrator → Guardians first.</p>}
      <button className="primary-btn" type="submit" disabled={!learnerId||!guardianId}>Create sample fee obligation</button>
    </form>
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
