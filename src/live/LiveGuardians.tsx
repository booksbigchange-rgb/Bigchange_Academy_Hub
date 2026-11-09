import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { addGuardian, guardiansForLearner, setGuardianConsent, verifyLink, type GuardianContact } from './api';
import { useAction, type PanelProps, type Role } from './shared';
import { parentDirectory } from './validation.mjs';

export default function LiveGuardians({ data, client, role, reload }: PanelProps & { role: Role }) {
  const { message, busy, run } = useAction(reload);
  const [learnerId, setLearnerId] = useState('');
  const [contacts, setContacts] = useState<GuardianContact[]>([]);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailOk, setEmailOk] = useState(false);
  const [waOk, setWaOk] = useState(false);
  const canAdd = role === 'admin' || role === 'teacher';
  const [consentFor, setConsentFor] = useState('');
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentWa, setConsentWa] = useState(false);
  const learner = data.learners.find(l => l.id === learnerId);
  const [dirQuery, setDirQuery] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const directory = parentDirectory(data, dirQuery).filter(g => !pendingOnly || g.pending.length > 0);
  const pendingTotal = data.links.filter(l => !l.verified).length;

  const loadContacts = useCallback(async () => {
    if (!learnerId) { setContacts([]); return; }
    try { setContacts(await guardiansForLearner(client, learnerId)); setLoadError(''); }
    catch (error) { setContacts([]); setLoadError(error instanceof Error ? error.message : 'Could not load contacts'); }
  }, [client, learnerId]);
  useEffect(() => { void loadContacts(); }, [loadContacts]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const ok = await run(() => addGuardian(client, learnerId, { name, email, phone, emailOptIn: emailOk, whatsappOptIn: waOk }),
      role === 'admin' ? 'Guardian added and verified.' : 'Guardian added. An administrator must verify the link before the parent can see this student.');
    if (ok) { setName(''); setEmail(''); setPhone(''); setEmailOk(false); setWaOk(false); await loadContacts(); }
  }
  return <section className="panel operations" aria-label="Guardians">
    <span className="eyebrow">GUARDIANS</span><h2>Guardian contacts</h2>
    <p className="quiet">Phone numbers and emails are personal data. Use them only for school business. This app does not send messages; it only stores contacts and whether the parent agreed.</p>
    {(role === 'admin' || role === 'finance') && <div className="people-enroll" aria-label="All parents">
      <h3>All parents ({data.guardians.length}){pendingTotal > 0 && <> · <span className="tag amber">{pendingTotal} link{pendingTotal === 1 ? '' : 's'} waiting for verification</span></>}</h3>
      <label>Search parents<input type="search" value={dirQuery} onChange={e => setDirQuery(e.target.value)} placeholder="Name, phone, email or child" /></label>
      <label><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} /> Only parents waiting for verification</label>
      {directory.length === 0 ? <p className="quiet">{data.guardians.length === 0 ? 'No parents recorded yet. Choose a student below to add one.' : 'No parents match.'}</p> :
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table><thead><tr><th>Parent</th><th>Phone</th><th>Email</th><th>Permission</th><th>Children</th></tr></thead><tbody>
          {directory.map(g => <tr key={g.id}><td>{g.display_name}</td><td>{g.phone_e164 ?? '—'}</td><td>{g.email ?? '—'}</td>
            <td>{[g.email_opt_in && 'Email', g.whatsapp_opt_in && 'WhatsApp'].filter(Boolean).join(', ') || 'None given'}</td>
            <td>{g.verified.map(c => c.name).join(', ')}
              {g.pending.map(c => <span key={c.learnerId}>{g.verified.length ? ', ' : ''}{c.name} <span className="tag amber">Pending</span>
                {role === 'admin' && <> <button className="small-btn" disabled={busy}
                  onClick={() => void run(() => verifyLink(client, c.learnerId, g.id), 'Verified ' + g.display_name + ' for ' + c.name + '.').then(loadContacts)}>Verify</button></>}</span>)}
              {!g.verified.length && !g.pending.length && '—'}</td></tr>)}
        </tbody></table></div>}
    </div>}
    {data.learners.length === 0 ? <p className="quiet">No students available yet.</p> : <>
      <label>Student<select value={learnerId} onChange={e => setLearnerId(e.target.value)}><option value="">Choose a student</option>
        {data.learners.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}</select></label>
      {learner && <>
        <h3>Guardians of {learner.display_name}</h3>
        {loadError && <p className="ops-feedback" role="alert">{loadError}</p>}
        {!loadError && contacts.length === 0 ? <p className="quiet">No guardian recorded yet.</p> : contacts.length > 0 &&
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Permission</th><th>Verified</th></tr></thead><tbody>
            {contacts.map(c => <tr key={c.guardian_id}><td>{c.display_name}</td><td>{c.phone_e164 ?? '—'}</td><td>{c.email ?? '—'}</td>
              <td>{[c.email_opt_in && 'Email', c.whatsapp_opt_in && 'WhatsApp'].filter(Boolean).join(', ') || 'None given'}
                {canAdd && c.verified && <> <button className="text-btn" type="button" onClick={() => { setConsentFor(c.guardian_id); setConsentEmail(c.email_opt_in); setConsentWa(c.whatsapp_opt_in); }}>Change</button></>}
                {consentFor === c.guardian_id && <form onSubmit={e => { e.preventDefault(); void run(() => setGuardianConsent(client, c.guardian_id, consentEmail, consentWa), 'Permission updated for ' + c.display_name + '.').then(() => { setConsentFor(''); void loadContacts(); }); }}>
                  <label><input type="checkbox" checked={consentWa} disabled={!c.phone_e164} onChange={e => setConsentWa(e.target.checked)} /> Agreed to WhatsApp</label>
                  <label><input type="checkbox" checked={consentEmail} disabled={!c.email} onChange={e => setConsentEmail(e.target.checked)} /> Agreed to email</label>
                  <button className="small-btn" type="submit" disabled={busy}>Save permission</button> <button className="text-btn" type="button" onClick={() => setConsentFor('')}>Cancel</button>
                </form>}</td>
              <td>{c.verified ? <span className="tag green">Verified</span> : <>
                <span className="tag amber">Pending</span>{role === 'admin' && <> <button className="small-btn" disabled={busy}
                  onClick={() => void run(() => verifyLink(client, learner.id, c.guardian_id), 'Guardian verified.').then(loadContacts)}>Verify</button></>}</>}</td></tr>)}
          </tbody></table></div>}
        {canAdd && <form className="ops-form" onSubmit={add}>
          <h3>Add a guardian</h3>
          <p className="quiet">If this parent is already recorded (same email or phone), they are linked to this student instead of being duplicated. That is how a parent with several children is handled.</p>
          <label>Guardian name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Phone (09XXXXXXXX or +251…)<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label><input type="checkbox" checked={emailOk} onChange={e => setEmailOk(e.target.checked)} /> Parent agreed to be emailed</label>
          <label><input type="checkbox" checked={waOk} onChange={e => setWaOk(e.target.checked)} /> Parent agreed to be contacted on WhatsApp</label>
          <button className="primary-btn" type="submit" disabled={busy}>+ Add guardian</button>
        </form>}
      </>}
    </>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
