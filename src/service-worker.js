/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

// Precache ビルド生成ファイル
precacheAndRoute(self.__WB_MANIFEST);

// 古いキャッシュを完全削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
  self.skipWaiting();
});

// App Shell routing → index.html はネットワーク優先に変更
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'html-cache',
    networkTimeoutSeconds: 5, // ネットワーク遅延対策
  })
);

// 画像キャッシュ（StaleWhileRevalidate）
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// skipWaiting を明示的に呼ぶ
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
