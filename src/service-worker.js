/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';

clientsClaim();

// precache ビルド生成ファイル
precacheAndRoute(self.__WB_MANIFEST);

// 新しい SW を即座に有効化
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 古いキャッシュを完全削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// index.html を fallback に設定
const handler = createHandlerBoundToURL('/index.html');
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api'),
  handler
);

// JS / CSS / MAP ファイルは最新を優先してキャッシュ
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.url.endsWith('.map'),
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// 画像キャッシュ
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.match(/\.(png|jpg|jpeg|svg|gif)$/),
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// API リクエストはネットワーク優先
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// skipWaiting を有効化し、新しい SW が即時反映される
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
