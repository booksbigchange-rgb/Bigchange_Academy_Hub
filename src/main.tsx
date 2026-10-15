import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getAcademyConfig } from './lib/academyConfig.mjs';
import './styles.css';

// No credentials in the public demonstration: this loads only the fictional-data UI.
// Providing a dedicated project URL and publishable key enables the separate Auth gate.
const SecureApp = lazy(() => import('./SecureApp'));
let config: ReturnType<typeof getAcademyConfig> = null;
let configError = '';
try {
  config = getAcademyConfig(import.meta.env.VITE_ACADEMY_SUPABASE_URL, import.meta.env.VITE_ACADEMY_SUPABASE_PUBLISHABLE_KEY);
} catch (error) {
  configError = error instanceof Error ? error.message : 'Invalid Academy authentication configuration.';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {configError
      ? <div className="auth-shell"><section className="auth-card"><h1>Preview configuration error</h1><p>{configError}</p><p>No school records are available.</p></section></div>
      : config
        ? <Suspense fallback={<div className="auth-shell"><p>Loading secure sign-in…</p></div>}><SecureApp url={config.url} publishableKey={config.publishableKey} /></Suspense>
        : <App />}
  </React.StrictMode>
);
