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
