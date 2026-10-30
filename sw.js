importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'stoa-cache-v14';
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

// Fichye ki ka chanje souvan e ki toujou dwe soti nan rezo a anvan (rezo-anvan, kach kòm sekou)
const NETWORK_FIRST = ['./', './index.html', './manifest.json'];

function isNetworkFirst(url){
  const path = url.replace(self.location.origin, '');
  return NETWORK_FIRST.some(p => path.endsWith(p.replace('./','/')) || path === self.location.origin + '/' );
}

// INSTALL: chak fichye kache apa. Si youn manke (404), SW a pa bloke: li enstale kanmenm
// (anvan, cache.addAll() te fè tout enstalasyon an echwe si yon sèl imaj te manke,
// epi SW a pa t janm aktive => pa gen token push).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((a) => cache.add(a).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  const req = event.request;
  const url = req.url;

  // Kite OneSignal travay poukont li (pa touche demann li yo)
  if(url.includes('onesignal.com')) return;

  const isAppShell = req.mode === 'navigate' || isNetworkFirst(url);

  if(isAppShell){
    // REZO-ANVAN: toujou eseye jwenn dènye vèsyon an sou entènèt.
    // Si pa gen koneksyon (oswa rezo a echwe), sèvi ak sa ki nan kach la kòm sekou.
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then((response) => {
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // KACH-ANVAN pou lòt fichye estatik yo (imaj, font, SDK) — rapid, mache san rezo
  event.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((response) => {
        const isCacheable = url.startsWith(self.location.origin)
          || url.includes('gstatic.com')
          || url.includes('fonts.googleapis.com')
          || url.includes('cdnjs.cloudflare.com');
        if(isCacheable && response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
