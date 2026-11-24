import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setStaffActive, setStaffRole, staffDirectory, type StaffMember } from './api';
import { useAction, type Data } from './shared';
import LiveTeacherProfile from './LiveTeacherProfile';
import { formatDate } from './fees.mjs';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', teacher: 'Teacher', finance: 'Finance' };

/** Admin only: give logins a staff role, change it, and switch access off or on. The database enforces every rule. */
export default function LiveStaff({ client, email, reload, data }: { client: SupabaseClient; email: string; reload: () => Promise<void>; data: Data }) {
  const [list, setList] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    try { setList(await staffDirectory(client)); setLoadError(''); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load the staff list'); }
  }, [client]);
  useEffect(() => { void load(); }, [load]);
  const { message, busy, run } = useAction(async () => { await Promise.all([load(), reload()]); });
  const [editFor, setEditFor] = useState<StaffMember | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('teacher');
  const [profileId, setProfileId] = useState('');

  const isMe = (m: StaffMember) => m.email.toLowerCase() === email.toLowerCase();
  const waiting = (list ?? []).filter(m => !m.staff_id);
  const staff = (list ?? []).filter(m => m.staff_id);
  function open(m: StaffMember) { setEditFor(m); setName(m.display_name ?? ''); setRole(m.role ?? 'teacher'); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editFor) return;
    if (await run(() => setStaffRole(client, editFor.user_id, role, name), `Role saved: ${name.trim()} · ${ROLE_LABEL[role] ?? role}.`)) setEditFor(null);
  }
  function toggle(m: StaffMember) {
    if (!m.staff_id) return;
    const off = m.active;
    const classes = off && m.class_count > 0
      ? ` Their ${m.class_count === 1 ? 'class still shows' : m.class_count + ' classes still show'} them as teacher: choose a new teacher under Classes.` : '';
    void run(() => setStaffActive(client, m.staff_id as string, !off),
      off ? `Access switched off for ${m.display_name ?? m.email}. They can no longer see anything.${classes}` : `Access switched on for ${m.display_name ?? m.email}.`);
  }

  return <section className="panel operations" aria-label="Staff">
    <span className="eyebrow">STAFF</span><h2>Staff and roles</h2>
    <div className="people-enroll">
      <h3>Adding someone new</h3>
      <ol>
        <li>In Supabase: <strong>Authentication → Users → Add user</strong>, their email, tick <strong>Auto Confirm User</strong>. (With Google sign-in on, they can then sign in with Google; otherwise give them the password.)</li>
        <li>Come back here and press <strong>Refresh list</strong>. They appear under <strong>Waiting for a role</strong>; press <strong>Give a role</strong>.</li>
      </ol>
      <button className="small-btn" type="button" disabled={busy} onClick={() => void run(async () => { await load(); }, 'List refreshed.')}>Refresh list</button>
    </div>
    {loadError && <p className="ops-feedback" role="alert">{loadError}</p>}
    {!list && !loadError && <p role="status">Loading…</p>}
    {list && <>
      <h3>Waiting for a role ({waiting.length})</h3>
      {waiting.length === 0 ? <p className="quiet">Nobody is waiting. New logins appear here after you add them in Supabase.</p> :
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Logins waiting for a role"><table><thead><tr><th>Email</th><th>Last signed in</th><th>Action</th></tr></thead><tbody>
          {waiting.map(m => <tr key={m.user_id}><td>{m.email}</td><td>{m.last_sign_in_at ? formatDate(m.last_sign_in_at) : 'Never'}</td>
            <td><button className="small-btn" disabled={busy} onClick={() => open(m)}>Give a role</button></td></tr>)}
        </tbody></table></div>}
      <h3>Staff ({staff.length})</h3>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Staff members"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Classes</th><th>Access</th><th>Action</th></tr></thead><tbody>
        {staff.map(m => <tr key={m.user_id}><td>{m.display_name ?? '—'}</td><td>{m.email}</td><td>{ROLE_LABEL[m.role ?? ''] ?? '—'}</td><td>{m.class_count}</td>
          <td><span className={'tag ' + (m.active ? 'green' : 'red')}>{m.active ? 'On' : 'Off'}</span></td>
          <td><button className="small-btn" type="button" aria-label={'Profile of ' + (m.display_name ?? m.email)} onClick={() => setProfileId(profileId === m.user_id ? '' : m.user_id)}>{profileId === m.user_id ? 'Hide profile' : 'Profile'}</button>{' '}
            {isMe(m) ? <span className="quiet">You</span> : <>
            <button className="small-btn" disabled={busy} onClick={() => open(m)}>Change role</button>{' '}
            <button className="small-btn" disabled={busy} onClick={() => toggle(m)}>{m.active ? 'Switch off' : 'Switch on'}</button></>}</td></tr>)}
      </tbody></table></div>
    </>}
    {(() => { const m = staff.find(x => x.user_id === profileId); return m ? <LiveTeacherProfile key={m.user_id} member={m} data={data} onClose={() => setProfileId('')} /> : null; })()}
    {editFor && <form className="ops-form" aria-label="Staff role" onSubmit={save}>
      <h3>{editFor.staff_id ? 'Change role' : 'Give a role'} · {editFor.email}</h3>
      <label>Name shown in the app<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Role<select value={role} onChange={e => setRole(e.target.value)}>
        <option value="teacher">Teacher: their own classes, students, attendance and parent payments</option>
        <option value="finance">Finance: all payments (check, reminders, download)</option>
        <option value="admin">Admin: everything, including approving payments and managing staff</option></select></label>
      {role === 'admin' && <p className="quiet">Admins can see and change everything. Give this only to people you trust fully.</p>}
      {editFor.staff_id && !editFor.active && <p className="quiet">Saving also switches their access back on.</p>}
      <button className="primary-btn" type="submit" disabled={busy}>Save role</button>
      <button className="text-btn" type="button" onClick={() => setEditFor(null)}>Close</button>
    </form>}
    <p className="ops-feedback" role="status" aria-live="polite">{message}</p>
  </section>;
}
