/* public/sw.js */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  // 事前キャッシュ（絶対/相対パスで指定）
  workbox.precaching.precacheAndRoute([
    { url: '/DID-PWA-app/', revision: null },
    { url: '/DID-PWA-app/index.html', revision: null },
    { url: '/DID-PWA-app/offline.html', revision: null }
  ]);

  // HTMLナビゲーション: NetworkFirst
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      try {
        return await new workbox.strategies.NetworkFirst({
          cacheName: 'html-cache',
        }).handle({ request: new Request('/DID-PWA-app/') });
      } catch (error) {
        return caches.match('/DID-PWA-app/offline.html');
      }
    }
  );

  // 静的アセット (JS/CSS)
  workbox.routing.registerRoute(
    ({ request }) => ['style','script','worker'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({ cacheName: 'static-assets' })
  );

  // 画像
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'image-cache',
      plugins: [new workbox.expiration.ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30 })],
    })
  );

  // 外部 API
  workbox.routing.registerRoute(
    ({ url, request }) => request.method === 'GET' && url.origin !== self.location.origin,
    new workbox.strategies.NetworkFirst({ cacheName: 'api-cache' })
  );
}
