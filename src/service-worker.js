/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

// Workbox がビルド時に差し込むファイル一覧を precache
precacheAndRoute(self.__WB_MANIFEST);

// index.html を fallback に設定（古いJS/CSSが404でもアプリを表示可能にする）
const handler = createHandlerBoundToURL('/index.html');
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api'),
  handler
);

// JS / CSS は最新を優先してキャッシュ
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// 画像キャッシュ
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// skipWaiting を有効化
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
