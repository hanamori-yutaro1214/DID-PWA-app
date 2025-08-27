/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";

const SW_VERSION = "v1.0.3"; // 新しいバージョンに更新

// 即時適用
self.addEventListener("install", (event) => {
  self.skipWaiting(); // インストール後すぐ新しい SW を適用
  event.waitUntil(
    caches.open(`offline-${SW_VERSION}`).then((cache) => cache.add("/offline.html"))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 古いキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.includes(SW_VERSION))
          .map((key) => caches.delete(key))
      );
      await clients.claim(); // 新しい SW をすぐ制御下に置く
    })()
  );
});

// precache
precacheAndRoute(self.__WB_MANIFEST);

// HTMLナビゲーション
const handler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// JS, CSS → StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style",
  new StaleWhileRevalidate({ cacheName: `static-resources-${SW_VERSION}` })
);

// 画像 → CacheFirst
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: `images-${SW_VERSION}`,
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

// API → NetworkFirst
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({ cacheName: `api-${SW_VERSION}` })
);

// 新しい SW をすぐ反映するためのメッセージ受信
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
