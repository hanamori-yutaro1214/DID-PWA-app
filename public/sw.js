/* public/sw.js */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  const PUBLIC_URL = process.env.PUBLIC_URL || '';

  // 事前キャッシュ
  workbox.precaching.precacheAndRoute([
    { url: `${PUBLIC_URL}/`, revision: null },
    { url: `${PUBLIC_URL}/index.html`, revision: null },
    { url: `${PUBLIC_URL}/offline.html`, revision: null }
  ]);

  // HTMLナビゲーション: NetworkFirst
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      try {
        return await new workbox.strategies.NetworkFirst({
          cacheName: 'html-cache',
        }).handle({ request: new Request(`${PUBLIC_URL}/`) });
      } catch (error) {
        return caches.match(`${PUBLIC_URL}/offline.html`);
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
