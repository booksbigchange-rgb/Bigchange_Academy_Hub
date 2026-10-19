import {useState,type FormEvent} from 'react';
import {addDemoFeeObligation,updateDemoFeeObligation} from '../lib/finance.mjs';
import type {Person} from './AcademyOperations';
import type {Guardian} from './AcademyGuardianAdmin';
export type SampleFee={learnerId:string;student:string;guardianId:string;guardian:string;due:number;recorded:number;period:string};
type Adjustment={kind:'adjustment';student:string;previous:number;next:number;delta:number;previousPeriod:string;period:string};
type Props={learners:Person[];guardians:Guardian[];ledger:SampleFee[];onUpdate:(next:SampleFee[])=>void;onCreated:(index:number)=>void;onAdjustment?:(change:Adjustment)=>void};
export default function AcademyFeePlan({learners,guardians,ledger,onUpdate,onCreated,onAdjustment}:Props){
  const [learnerId,setLearnerId]=useState('');
  const [guardianId,setGuardianId]=useState('');
  const [period,setPeriod]=useState('2026-11');
  const [due,setDue]=useState('2500');
  const [message,setMessage]=useState('');
  const [editingIndex,setEditingIndex]=useState<number|null>(null);
  const [editPeriod,setEditPeriod]=useState('2026-10');
  const [editDue,setEditDue]=useState('2500');
  const eligibleGuardians=guardians.filter(g=>g.active!==false&&g.learnerIds.includes(learnerId));
  function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      const next=addDemoFeeObligation(ledger,{learnerId,guardianId,period,due:Number(due)},learners,guardians);
      onUpdate(next);onCreated(next.length-1);
      setMessage('Created a fictional external-fee obligation. Nothing was charged or requested.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not create a sample obligation');}
  }
  function periodInput(value:string){
    if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))return value;
    const old=/^([A-Za-z]+) (20\d{2})$/.exec(value);
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const index=old?months.indexOf(old[1]):-1;
    return old&&index>=0?old[2]+'-'+String(index+1).padStart(2,'0'):'2026-10';
  }
  function chooseFee(value:string){
    const index=value===''?null:Number(value);setEditingIndex(index);
    const row=index===null?undefined:ledger[index];
    if(row){setEditPeriod(periodInput(row.period));setEditDue(String(row.due));}
  }
  function saveAdjustment(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(editingIndex===null)return;
    const old=ledger[editingIndex];if(!old){setMessage('Choose an existing sample fee row');return;}
    try{
      const nextDue=Number(editDue);
      const next=updateDemoFeeObligation(ledger,editingIndex,{period:editPeriod,due:nextDue});
      onUpdate(next);
      onAdjustment?.({kind:'adjustment',student:old.student,previous:old.due,next:nextDue,delta:nextDue-old.due,
        previousPeriod:old.period,period:editPeriod});
      setMessage('Updated the fictional fee obligation. Recorded payments were preserved; nothing was charged.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not update sample fee');}
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
    <div className="fee-adjustment">
      <h3>Adjust an existing sample fee</h3>
      <p>Correct the expected amount or fee month. The recorded amount cannot be overwritten or reduced below the existing external payment record.</p>
      <label>Existing fee<select value={editingIndex===null?'':String(editingIndex)} onChange={e=>chooseFee(e.target.value)}>
        <option value="">Choose a fee row</option>{ledger.map((row,index)=><option key={row.learnerId+'-'+row.period} value={index}>
          {row.student} · {row.period} · ETB {row.due.toLocaleString('en-US')}
        </option>)}
      </select></label>
      {editingIndex!==null&&ledger[editingIndex]&&<form className="ops-form fee-edit-form" onSubmit={saveAdjustment}>
        <label>Fee month (Gregorian)<input type="month" min="2026-01" max="2028-12" required value={editPeriod} onChange={e=>setEditPeriod(e.target.value)}/></label>
        <label>Expected amount (ETB)<input type="number" min={Math.max(1,ledger[editingIndex].recorded)} max="1000000" step="1" required value={editDue} onChange={e=>setEditDue(e.target.value)}/></label>
        <p className="quiet">Already recorded: ETB {ledger[editingIndex].recorded.toLocaleString('en-US')}</p>
        <button className="primary-btn" type="submit">Save fee adjustment</button>
      </form>}
    </div>
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
