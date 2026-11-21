import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMode } from '../src/live/install.mjs';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const base = { standalone: false, canPrompt: false, dismissed: false };

test('Android with an install prompt gets the Install button', () => {
  assert.equal(installMode({ ...base, userAgent: ANDROID, canPrompt: true }), 'prompt');
});
test('iPhone Safari gets the Add to Home Screen steps', () => {
  assert.equal(installMode({ ...base, userAgent: IPHONE, maxTouchPoints: 5 }), 'ios');
  assert.equal(installMode({ ...base, userAgent: IPAD, maxTouchPoints: 5 }), 'ios');
});
test('nothing is shown when it cannot help or is not wanted', () => {
  assert.equal(installMode({ ...base, userAgent: IPHONE_CHROME }), 'none', 'Chrome on iPhone cannot add to home screen');
  assert.equal(installMode({ ...base, userAgent: IPAD, maxTouchPoints: 0 }), 'none', 'a real Mac');
  assert.equal(installMode({ ...base, userAgent: ANDROID }), 'none', 'no prompt available');
  assert.equal(installMode({ ...base, userAgent: IPHONE, standalone: true }), 'none', 'already installed');
  assert.equal(installMode({ ...base, userAgent: ANDROID, canPrompt: true, dismissed: true }), 'none', 'staff said not now');
});
test('manifest makes the Hub installable', () => {
  const m = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.ok(m.icons.some(i => i.sizes === '192x192'));
});
test('offline helper never caches school data or other sites', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /request\.method !== 'GET'/);
  assert.doesNotMatch(sw.replace(/^\s*\/\/.*$/gm, ''), /supabase/i);
});
test('security headers allow the worker and the manifest', () => {
  const h = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(h, /worker-src 'self'/);
  assert.match(h, /manifest-src 'self'/);
});
