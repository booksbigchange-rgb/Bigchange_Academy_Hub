import {useState,type FormEvent} from 'react';
import {addDemoGuardian,linkDemoChild,unlinkDemoChild,setDemoGuardianActive} from '../lib/guardian-admin.mjs';
import type {Person} from './AcademyOperations';
export type Guardian={id:string;name:string;learnerIds:string[];active?:boolean};
type Props={guardians:Guardian[];learners:Person[];onChange:(next:Guardian[])=>void};
export default function AcademyGuardianAdmin({guardians,learners,onChange}:Props){
  const [name,setName]=useState('Sample Guardian Delta');
  const [chosen,setChosen]=useState('');
  const [learnerId,setLearnerId]=useState('');
  const [message,setMessage]=useState('');
  const current=guardians.find(g=>g.id===chosen);
  const added=guardians.filter(g=>g.id.startsWith('guardian-demo-'));
  const activeChildren=learners.filter(l=>l.active!==false);
  function act(fn:()=>Guardian[],success:string){
    try{onChange(fn());setMessage(success);}catch(error){setMessage(error instanceof Error?error.message:'Could not update fictional guardian');}
  }
  function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();act(()=>addDemoGuardian(guardians,name),'Fictional guardian created. Link sample children using the separate form.');
  }
  function link(event:FormEvent<HTMLFormElement>){
    event.preventDefault();act(()=>linkDemoChild(guardians,chosen,learnerId,learners),'Added a fictional learner link; this is not custody verification.');
  }
  return <div className="operations guardian-admin">
    <section className="panel">
      <span className="eyebrow">ADMIN · FICTIONAL GUARDIAN RELATIONSHIPS</span><h2>Guardian management</h2>
      <p>Create demonstration profiles and associate only imaginary learners. In a real school, identity and parental authority must be verified securely before any link is approved.</p>
      <div className="operations-grid">
        <form className="people-form" onSubmit={create}>
          <h3>+ Add Guardian</h3>
          <label>Sample guardian name<input required value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label>
          <button className="primary-btn" type="submit">Add fictional guardian</button>
        </form>
        <form className="people-form" onSubmit={link}>
          <h3>Link fictional learner</h3>
          <label>Newly created guardian<select required value={chosen} onChange={e=>{setChosen(e.target.value);setMessage('');}}>
            <option value="">Choose a sample guardian</option>
            {added.map(g=><option key={g.id} value={g.id}>{g.name}{g.active===false?' (Inactive)':''}</option>)}
          </select></label>
          <label>Fictional learner<select required value={learnerId} onChange={e=>setLearnerId(e.target.value)}>
            <option value="">Choose an active learner</option>{activeChildren.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
          <button className="primary-btn" type="submit" disabled={!chosen||!learnerId||current?.active===false}>Link sample learner</button>
        </form>
      </div>
      <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
    </section>
    <section className="panel">
      <h2>Fictional guardian directory ({guardians.length})</h2>
      <div className="table-wrap"><table><thead><tr><th>Guardian</th><th>Linked learners</th><th>Status</th><th>Management</th></tr></thead>
        <tbody>{guardians.map(g=><tr key={g.id}>
          <td><strong>{g.name}</strong><small className="guardian-id">{g.id}</small></td>
          <td>{g.learnerIds.length?g.learnerIds.map(id=>{
            const learner=learners.find(x=>x.id===id);
            return <span key={id} className="family-linked-learner">
              {learner?.name??'Sample learner'}
              {g.id.startsWith('guardian-demo-')&&<button className="text-btn" type="button"
                aria-label={'Unlink '+id+' from '+g.name} onClick={()=>act(()=>unlinkDemoChild(guardians,g.id,id),'Removed fictional child link.')}>×</button>}
            </span>;
          }):'No linked learners'}</td>
          <td>{g.active===false?'Inactive':'Active (demo)'}</td>
          <td>{g.id.startsWith('guardian-demo-')?<button type="button" className="small-btn"
            onClick={()=>act(()=>setDemoGuardianActive(guardians,g.id,g.active===false),
              g.active===false?'Reactivated fictional guardian.':'Deactivated fictional guardian.')}>
              {g.active===false?'Reactivate':'Deactivate'}
            </button>:<span className="quiet">Fixture · read only</span>}</td>
        </tr>)}</tbody></table></div>
      <p className="quiet">No email, phone, child consent, invitations, real financial access or real guardian permissions are created. These simulated links vanish on page reload.</p>
    </section>
  </div>;
}
