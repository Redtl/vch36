/* ==========================================================================
   vch36 · sw.js — офлайн-кэш оболочки (2.1)

   Схема: stale-while-revalidate. Отдаём из кэша (мгновенный старт даже
   без сети) и параллельно обновляем копию в фоне.

   ВАЖНО: при обновлении файлов поднимите версию CACHE — иначе браузер
   продолжит отдавать старую копию. Полный сброс из консоли: __vchCacheReset().
   ========================================================================== */
"use strict";

const CACHE = "vch36-v2";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
