// Oura Insights — Service Worker
// Caches the app shell for full offline support.

const CACHE_NAME = 'oura-insights-v1';

const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap'
];

// ── INSTALL: cache all shell assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets reliably; best-effort for external fonts
      const local = SHELL_ASSETS.filter(u => u.startsWith('./'));
      const external = SHELL_ASSETS.filter(u => !u.startsWith('./'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(external.map(u => cache.add(u)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for shell, network-first for everything else ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful responses for shell assets
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
