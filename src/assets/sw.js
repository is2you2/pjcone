const CACHE_NAME = 'my-pwa-cache-v1';
// 경로 업데이트 필수
const URLs = [
  '/index.html',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLs);
      })
  );
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

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// 오프라인 상태에서 동작 설정
self.addEventListener('offline', (event) => {
  console.log('You are now offline.');
  // 오프라인 상태에 대한 UI/UX 처리 추가
});

// 온라인 상태에서 동작 설정
self.addEventListener('online', (event) => {
  console.log('You are now online.');
  // 동기화 로직 실행 등 추가 작업
});