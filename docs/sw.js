/* public/sw.js */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  const SW_VERSION = 'v1.0.24'; // ビルドごとに更新する

  // クライアント制御と skipWaiting
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  // 事前キャッシュ（revisionにバージョンを追加）
  workbox.precaching.precacheAndRoute([
    { url: '/DID-PWA-app/', revision: SW_VERSION },
    { url: '/DID-PWA-app/index.html', revision: SW_VERSION },
    { url: '/DID-PWA-app/offline.html', revision: SW_VERSION }
  ]);

  // 古いキャッシュをバージョン管理で削除
  const RUNTIME_CACHE = `runtime-cache-${SW_VERSION}`;
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!key.includes(SW_VERSION) && !key.startsWith('workbox-precache')) {
              return caches.delete(key);
            }
          })
        )
      ).then(() => self.clients.claim())
    );
  });

  // HTMLナビゲーション: NetworkFirst
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async ({ request }) => {
      try {
        return await new workbox.strategies.NetworkFirst({
          cacheName: 'html-cache',
        }).handle({ request });
      } catch (error) {
        return caches.match('/DID-PWA-app/offline.html');
      }
    }
  );

  // JS / CSS / worker は StaleWhileRevalidate
  workbox.routing.registerRoute(
    ({ request }) => ['style','script','worker'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: `static-assets-${SW_VERSION}`
    })
  );

  // 画像キャッシュ
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: `image-cache-${SW_VERSION}`,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 60 * 60 * 24 * 30
        })
      ]
    })
  );

  // 外部 API
  workbox.routing.registerRoute(
    ({ url, request }) => request.method === 'GET' && url.origin !== self.location.origin,
    new workbox.strategies.NetworkFirst({
      cacheName: `api-cache-${SW_VERSION}`
    })
  );
}
