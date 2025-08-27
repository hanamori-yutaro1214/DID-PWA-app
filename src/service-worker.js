/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";

const SW_VERSION = "v1.0.0";

// 即時適用
self.skipWaiting();
clientsClaim();

// precache
precacheAndRoute(self.__WB_MANIFEST);

// HTMLナビゲーション
const handler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// JS, CSS → SWR
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

// オフラインフォールバック
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(`offline-${SW_VERSION}`).then((cache) => cache.add("/offline.html"))
  );
});

// 古いキャッシュ削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.includes(SW_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
});
