/**
 * Fail closed: reject partial configuration, plaintext HTTP, and secret keys.
 * Only Vite's intended public publishable key may reach a browser build.
 */
export function getAcademyConfig(url, publishableKey) {
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) throw new Error('Both Academy URL and publishable key are required.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid Academy URL.'); }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
      parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
    throw new Error('Only a dedicated HTTPS Supabase project URL is accepted.');
  if (typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))
    throw new Error('Use a Supabase publishable key. Never provide a service/secret key.');
  return { url: parsed.origin, publishableKey };
}
