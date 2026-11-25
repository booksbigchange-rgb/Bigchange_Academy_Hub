// Plain-language messages for a Google sign-in that came back with an error in the address bar.
// The raw text is never shown: anyone can put text in a link, so only known cases get their own message.
const WHERE = 'Supabase → Authentication → Sign In / Providers → Google';

/** @param {string} code the `error` value  @param {string} description the `error_description` value */
export function googleSignInMessage(code = '', description = '') {
  const text = `${code} ${description}`;
  if (!code && !description) return '';
  if (/signup|sign-up|not allowed|user not found/i.test(text))
    return 'This Google account has not been added to the Academy. Ask the administrator to add your email first.';
  if (/exchange external code|invalid_client|unauthorized_client|client secret|invalid_grant/i.test(text))
    return `Google sign-in is not set up correctly: Supabase could not confirm the sign-in with Google. An administrator should copy the Client ID and Client Secret again from Google Cloud into ${WHERE}, then save.`;
  if (/provider is not enabled|unsupported provider|provider.*disabled/i.test(text))
    return `Google sign-in is switched off. Use email and password, or ask an administrator to switch it on in ${WHERE}.`;
  if (/access_denied/i.test(code))
    return 'Google sign-in was cancelled. Try again, or use email and password.';
  return 'Google sign-in did not complete. Please try again. If it keeps happening, tell the administrator.';
}
