/* ==========================================================================
   vch36 · sw.js — офлайн-кэш оболочки (2.1)

   - Для разметки, стилей и модулей (index.html, css/*, js/*) используем
     network-first: при наличии сети сразу берём свежую версию с сервера,
     чтобы HTML, CSS и JS никогда не рассинхронизировались после обновления.
     При отсутствии сети — отдаём из кэша (офлайн).
   - Для тяжёлых неизменяемых данных (data/*, vendor/*) используем
     stale-while-revalidate: мгновенный старт из кэша.

   ВАЖНО: при обновлении поднимите CACHE и V в index.html.
   ========================================================================== */
"use strict";

const CACHE = "vch36-v10";

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

  const isHeavyAsset = url.pathname.includes("/data/") || url.pathname.includes("/vendor/");

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    if (isHeavyAsset) {
      const network = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    }

    try {
      const fresh = await fetch(req, { cache: "no-cache" });
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone());
        return fresh;
      }
      return cached || fresh;
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
  })());
});
