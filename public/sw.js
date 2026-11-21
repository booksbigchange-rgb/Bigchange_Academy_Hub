// BigChange Academy Hub service worker.
// Privacy rule: only the app's own files (same origin, GET) are cached. School data from
// Supabase and anything on another host is never touched or stored here.
const CACHE = 'academy-shell-v1';
const SHELL = ['./', './manifest.webmanifest', './bigchange-academy-logo.svg', './icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first so staff always get the newest version; cached copy only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then(response => { const copy = response.clone(); caches.open(CACHE).then(c => c.put('./', copy)); return response; })
      .catch(() => caches.match('./')));
    return;
  }

  // Built files have a content hash in their name, so a cached copy never goes stale.
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
      return response;
    })));
  }
});

// Phone alerts (M6 step 5). The alert carries only a title, one short line and which chat to open; never message text.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'BigChange Academy';
  const body = typeof data.body === 'string' ? data.body.slice(0, 160) : 'New message';
  const url = typeof data.url === 'string' && data.url.startsWith('./?chat=') ? data.url : './';
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof data.tag === 'string' ? data.tag : 'chat', renotify: true,
    icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  const chat = new URL(target).searchParams.get('chat');
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ type: 'open-chat', chat }); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
