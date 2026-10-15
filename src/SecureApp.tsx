import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

type AcademyRole = 'admin' | 'teacher' | 'finance' | 'learner' | 'guardian';
type GateState = 'checking' | 'signed-out' | 'verified' | 'not-enrolled' | 'error';

export default function SecureApp({ url, publishableKey }: { url: string; publishableKey: string }) {
  const client = useMemo(() => createClient(url, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
  }), [url, publishableKey]);
  const [state, setState] = useState<GateState>('checking');
  const [role, setRole] = useState<AcademyRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkIdentity() {
      const { data, error } = await client.auth.getUser(); // verified by Auth API, not client metadata
      if (!active) return;
      if (error || !data.user) { setRole(null); setState('signed-out'); setUserEmail(''); return; }
      setState('checking');
      const userId = data.user.id;
      const checks = [
        { table: 'academy_staff', roleColumn: 'role' },
        { table: 'academy_learners', roleColumn: null },
        { table: 'academy_guardians', roleColumn: null }
      ] as const;
      for (const item of checks) {
        // The database RLS policy, not this UI filter, enforces who can view a record.
        const result = await client.from(item.table).select(item.roleColumn ? 'role' : 'id').eq('auth_user_id', userId).maybeSingle();
        if (!active) return;
        if (result.error) {
          setRole(null);
          setState('error');
          setMessage('Account verification is unavailable. Contact the Academy administrator.');
          return;
        }
        if (result.data) {
          const assigned: AcademyRole = item.roleColumn
            ? (result.data as { role: AcademyRole }).role
            : item.table === 'academy_learners' ? 'learner' : 'guardian';
          if (!['admin', 'teacher', 'finance', 'learner', 'guardian'].includes(assigned)) {
            setRole(null); setState('error'); return;
          }
          setRole(assigned);
          setUserEmail(data.user.email ?? 'Verified account');
          setState('verified');
          setMessage('');
          return;
        }
      }
      setRole(null); setState('not-enrolled');
      setMessage('Your login is valid, but no verified Academy role has been assigned.');
    }
    void checkIdentity();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      queueMicrotask(() => { if (active) void checkIdentity(); });
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [client]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setMessage('');
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setMessage('Sign-in unsuccessful. Check your details or contact your Academy administrator.'); }
    } finally {
      setPassword('');
      setWorking(false);
    }
  }

  async function signOut() {
    setWorking(true);
    const { error } = await client.auth.signOut();
    if (error) setMessage('Unable to sign out. Please try again.');
    else { setState('signed-out'); setRole(null); setMessage(''); }
    setWorking(false);
  }

  return <main className="auth-shell">
    <section className="auth-card" aria-label="Academy account">
      <img className="auth-logo" src={`${import.meta.env.BASE_URL}bigchange-academy-logo.svg`} alt="BigChange Academy" />
      <span className="eyebrow">PRIVATE ACCOUNT AREA</span>
      {state === 'checking' ? <><h1>Verifying your account</h1><p>Checking your identity and approved Academy membership.</p></> :
        state === 'signed-out' ? <>
          <h1>Academy sign in</h1>
          <p>Staff and invited Academy members only. There is no public registration.</p>
          <form className="auth-form" onSubmit={signIn}>
            <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
            <button className="primary-btn" type="submit" disabled={working}>{working ? 'Checking…' : 'Sign in'}</button>
          </form>
        </> : state === 'verified' ? <>
          <h1>Account verified</h1>
          <p>Signed in as <strong>{userEmail}</strong>.</p>
          <p>Approved Academy identity: <span className="auth-role">{role}</span>.</p>
          <p className="auth-restricted">Secure foundation only: all real student profiles, attendance, fees, grades and messages remain disabled until permissions and safeguarding tests pass.</p>
          <button className="small-btn" onClick={() => void signOut()} disabled={working}>Sign out</button>
        </> : <>
          <h1>{state === 'not-enrolled' ? 'Awaiting Academy approval' : 'Unable to verify account'}</h1>
          <p>{message}</p>
          <button className="small-btn" onClick={() => void signOut()} disabled={working}>Sign out</button>
        </>}
      {state === 'signed-out' && <p className="auth-feedback" role="status" aria-live="polite">{message}</p>}
      <p className="auth-footer">Protected Academy login · No payment collection · Contact an administrator for access</p>
    </section>
  </main>;
}
