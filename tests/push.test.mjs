import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pushSupport, base64UrlToBytes, chatFromUrl, deviceLabel } from '../src/live/push.mjs';

const ok = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, standalone: false, isIOS: false, vapidKey: 'BAAA', permission: 'default' };
test('alerts switch states', () => {
  assert.equal(pushSupport(ok), 'available');
  assert.equal(pushSupport({ ...ok, vapidKey: '' }), 'not-configured');
  assert.equal(pushSupport({ ...ok, isIOS: true }), 'ios-needs-install');
  assert.equal(pushSupport({ ...ok, isIOS: true, standalone: true }), 'available');
  assert.equal(pushSupport({ ...ok, hasPushManager: false }), 'unsupported');
  assert.equal(pushSupport({ ...ok, permission: 'denied' }), 'blocked');
});
test('VAPID key decoding', () => {
  assert.deepEqual([...base64UrlToBytes('AQID')], [1, 2, 3]);
  assert.deepEqual([...base64UrlToBytes('-_8')], [251, 255]);
});
test('chat links from alerts', () => {
  assert.equal(chatFromUrl('?chat=11111111-1111-1111-1111-111111111111'), '11111111-1111-1111-1111-111111111111');
  assert.equal(chatFromUrl('?chat=<script>'), '');
  assert.equal(chatFromUrl(''), '');
});
test('device labels', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), 'iPhone');
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari'), 'Android phone');
  assert.equal(deviceLabel('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)'), 'Chromebook');
});
test('the offline helper shows alerts without message text and opens only chat links', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /data\.url\.startsWith\('\.\/\?chat='\)/);
  assert.match(sw, /addEventListener\('notificationclick'/);
});

import vm from 'node:vm';
/** Runs public/sw.js in a sandbox with fake browser parts and returns its event handlers. */
function loadWorker() {
  const handlers = {}; const shown = []; const opened = []; const posted = [];
  const windows = [];
  const self = {
    location: { origin: 'https://hub.example' },
    registration: { scope: 'https://hub.example/', showNotification: async (title, options) => { shown.push({ title, ...options }); } },
    clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url); }, claim: async () => {} },
    addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: () => {}
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, caches: {}, fetch: async () => ({}), URL, Promise });
  return { handlers, shown, opened, posted, windows };
}
const pushEvent = data => { let wait; return { data: { json: () => JSON.parse(data) }, waitUntil: p => { wait = p; }, done: () => wait }; };

test('an alert shows only the given title and short line', async () => {
  const w = loadWorker();
  const e = pushEvent(JSON.stringify({ title: 'BigChange Academy', body: 'New message from Teacher A in Teachers', tag: 'chat-1', url: './?chat=11111111-1111-1111-1111-111111111111' }));
  w.handlers.push(e); await e.done();
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0].title, 'BigChange Academy');
  assert.equal(w.shown[0].body, 'New message from Teacher A in Teachers');
  assert.equal(w.shown[0].data.url, './?chat=11111111-1111-1111-1111-111111111111');
});
test('an alert cannot point to another website', async () => {
  const w = loadWorker();
  const e = pushEvent(JSON.stringify({ title: 'x', body: 'y', url: 'https://evil.example/' }));
  w.handlers.push(e); await e.done();
  assert.equal(w.shown[0].data.url, './');
});
test('a broken alert still shows a safe default', async () => {
  const w = loadWorker();
  let wait; w.handlers.push({ data: { json: () => { throw Error('bad'); } }, waitUntil: p => { wait = p; } }); await wait;
  assert.equal(w.shown[0].title, 'BigChange Academy');
});
test('tapping an alert opens that chat, or tells the open Hub to show it', async () => {
  const w = loadWorker();
  let wait; let closed = false;
  const tap = { notification: { close: () => { closed = true; }, data: { url: './?chat=11111111-1111-1111-1111-111111111111' } }, waitUntil: p => { wait = p; } };
  w.handlers.notificationclick(tap); await wait;
  assert.ok(closed);
  assert.deepEqual(w.opened, ['https://hub.example/?chat=11111111-1111-1111-1111-111111111111']);
  const msgs = []; let focused = false;
  w.windows.push({ url: 'https://hub.example/', postMessage: m => msgs.push(m), focus: async () => { focused = true; } });
  w.handlers.notificationclick(tap); await wait;
  assert.deepEqual(JSON.parse(JSON.stringify(msgs)), [{ type: 'open-chat', chat: '11111111-1111-1111-1111-111111111111' }]);
  assert.ok(focused);
});
