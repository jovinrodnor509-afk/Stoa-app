const CACHE_NAME = 'stoa-cache-v10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './bg-hero.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // App shell + static assets: cache-first (fast, works offline)
      if(cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache same-origin files AND known static libraries (fonts, Firebase SDK)
        // so the app keeps working with a weak/no connection after first visit.
        const url = event.request.url;
        const isCacheable = url.startsWith(self.location.origin)
          || url.includes('gstatic.com')
          || url.includes('fonts.googleapis.com')
          || url.includes('cdnjs.cloudflare.com');
        if(isCacheable && response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
