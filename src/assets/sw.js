const CACHE_NAME = 'my-pwa-cache-v1';
// 경로 업데이트 필수
const URLs = [
  '/index.html',
]

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (let i = 0, j = URLs.length; i < j; i++)
      await cache.add(URLs[i]);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (!(
    e.request.url.startsWith('http:') || e.request.url.startsWith('https:')
  )) return;

  e.respondWith((async () => {
    const r = await caches.match(e.request);
    if (r) return r;
    const response = await fetch(e.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(e.request, response.clone());
    return response;
  })());
});