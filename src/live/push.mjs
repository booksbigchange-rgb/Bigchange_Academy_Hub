/** Phone alert helpers (pure, unit-tested). */

/** What the alerts switch should say on this device. */
export function pushSupport({ hasServiceWorker, hasPushManager, hasNotification, standalone, isIOS, vapidKey, permission }) {
  if (!vapidKey) return 'not-configured';
  if (isIOS && !standalone) return 'ios-needs-install';
  if (!hasServiceWorker || !hasPushManager || !hasNotification) return 'unsupported';
  if (permission === 'denied') return 'blocked';
  return 'available';
}

/** The VAPID public key (base64url) as bytes, as pushManager.subscribe() needs it. */
export function base64UrlToBytes(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(value).length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The chat id from a link like ./?chat=<id>, or '' when absent or not a uuid. */
export function chatFromUrl(search) {
  const id = new URLSearchParams(search || '').get('chat') || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : '';
}

/** A short device name for the staff member's own list, e.g. "iPhone" or "Android phone". */
export function deviceLabel(userAgent) {
  const ua = String(userAgent || '');
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Windows/.test(ua)) return 'Windows computer';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Browser';
}
