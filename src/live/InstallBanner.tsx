import { useEffect, useState } from 'react';
import { INSTALL_DISMISS_KEY, installMode } from './install.mjs';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function readDismissed() { try { return localStorage.getItem(INSTALL_DISMISS_KEY) === '1'; } catch { return false; } }
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Offers to put the Hub on the phone's home screen. Android/Chrome: the browser's own install box. iPhone: three steps in Safari. */
export default function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as PromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const mode = installMode({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone: installed, canPrompt: !!promptEvent, dismissed });
  if (mode === 'none') return null;

  const dismiss = () => { try { localStorage.setItem(INSTALL_DISMISS_KEY, '1'); } catch { /* private window: just hide for now */ } setDismissed(true); };
  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    setPromptEvent(null);
    if (choice.outcome === 'accepted') setInstalled(true);
  };

  return <section className="install-banner" aria-labelledby="install-title">
    <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="44" height="44" alt="" />
    <div className="install-text">
      <h2 id="install-title">Put the Hub on your phone</h2>
      {mode === 'prompt'
        ? <p>Open it from your home screen like an app. It is the same Hub, with the same sign-in.</p>
        : <ol>
            <li>Tap the <strong>Share</strong> button <span aria-hidden="true">(square with an arrow)</span> in Safari.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>, then open the Hub from your home screen.</li>
          </ol>}
    </div>
    <div className="install-actions">
      {mode === 'prompt' && <button className="primary-btn" onClick={() => void install()}>Install</button>}
      <button className="small-btn" onClick={dismiss}>{mode === 'prompt' ? 'Not now' : 'Got it'}</button>
    </div>
  </section>;
}
