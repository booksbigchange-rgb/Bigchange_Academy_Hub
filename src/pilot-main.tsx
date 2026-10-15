import React, { useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import SecureApp from './SecureApp';
import { getAcademyConfig } from './lib/academyConfig.mjs';
import './styles.css';

// A limited test-only login at /pilot.html. No student data is available here.
// The publishable key is public by design; never input sb_secret_ or service_role.
const PROJECT_URL = 'https://nwpaqjzwqwkqxibwvusr.supabase.co';
const STORAGE_KEY = 'bigchange_pilot_publishable_key';

function Pilot() {
  const [key, setKey] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) ?? ''; }
    catch { return ''; }
  });
  const [activeKey, setActiveKey] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  function useKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const config = getAcademyConfig(PROJECT_URL, key.trim());
      if (!config) throw Error('Publishable key is required.');
      setActiveKey(config.publishableKey);
      // Public/publishable credential; saved only for test-link refresh/invite redirect.
      try { window.localStorage.setItem(STORAGE_KEY, config.publishableKey); } catch { /* optional */ }
      setAccepted(true);
      setError('');
    } catch {
      setError('Enter the sb_publishable_ key from the NEW Academy project. Never enter a secret key.');
    }
  }

  if (accepted) return <SecureApp url={PROJECT_URL} publishableKey={activeKey}/>;
  return <main className="auth-shell">
    <section className="auth-card">
      <img className="auth-logo" src={`${import.meta.env.BASE_URL}bigchange-academy-logo.svg`} alt="BigChange Academy"/>
      <span className="eyebrow">ADULT TEST ACCOUNTS ONLY</span>
      <h1>Connect the Academy pilot</h1>
      <p>This page is for testing identity and role isolation. The normal dashboard remains a fictional demo; real classes, financial records and messages are disabled.</p>
      <form className="auth-form" onSubmit={useKey}>
        <label>Supabase publishable key (not a password)
          <input autoComplete="off" spellCheck={false} type="text" required value={key}
            onChange={e => setKey(e.target.value)} placeholder="sb_publishable_..." />
        </label>
        <button type="submit" className="primary-btn">Open test sign-in</button>
      </form>
      <p role="status" className="auth-feedback">{error}</p>
      <p className="auth-footer">Confirm your project ID is nwpaqjzwqwkqxibwvusr. Only enter the publishable key from that project. Never send or paste a service-role, secret, database password or invitation link.</p>
    </section>
  </main>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Pilot/></React.StrictMode>);
