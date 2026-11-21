/** Decides which "install the Hub" help to show. Pure function so it can be unit-tested. */
export const INSTALL_DISMISS_KEY = 'academy-install-dismissed';

/**
 * @param {{ userAgent: string, maxTouchPoints?: number, standalone: boolean, canPrompt: boolean, dismissed: boolean }} env
 * @returns {'none' | 'prompt' | 'ios'}
 */
export function installMode({ userAgent, maxTouchPoints = 0, standalone, canPrompt, dismissed }) {
  if (standalone || dismissed) return 'none';
  if (canPrompt) return 'prompt';
  const ua = userAgent || '';
  // iPadOS 13+ reports itself as a Mac, so also check for a touch screen.
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  // On iPhone only Safari can add to the home screen; other iPhone browsers name themselves (CriOS, FxiOS, EdgiOS).
  if (apple && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'ios';
  return 'none';
}
