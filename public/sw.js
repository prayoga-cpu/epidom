// Epidom Service Worker — cache-first static assets, network-first navigation
// Supports offline POS shell loading. Orders use IndexedDB queue (idb-keyval),
// not SW background-sync, for broader browser compatibility (including iOS Safari).

// Bump this version on any precached-asset change (e.g. favicon) so the
// activate handler purges the old cache and install re-precaches fresh copies.
const CACHE_NAME = "epidom-v3";

// Minimal precache: only assets that are stable across builds
const PRECACHE = ["/favicon.ico"];

// On localhost (dev) the SW must exist (so Chrome treats the app as installable)
// but must NOT cache — otherwise it serves stale dev chunks and breaks HMR.
const IS_DEV =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Dev: pass everything through to the network (no caching) so HMR/fresh chunks
  // are never stale. The fetch handler still exists, which is all Chrome needs to
  // consider the app installable.
  if (IS_DEV) return;

  // Never cache API routes — always go network, let idb-keyval handle offline
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages): network-first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached ?? networkFetch;
    })
  );
});

// Web Push (OS-level notifications: new storefront orders, low/critical
// material stock — see src/lib/push/send.ts). Independent of the IS_DEV
// fetch-passthrough guard above; push must work in every environment.
self.addEventListener("push", (event) => {
  let payload = { title: "Epidom", body: "You have a new notification.", url: "/" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // Not valid JSON — fall back to plain text if there is any, else keep defaults.
      let text = "";
      try {
        text = event.data.text();
      } catch {
        // no-op — keep default body
      }
      if (text) payload.body = text;
    }
  }

  const options = {
    body: payload.body,
    // manifest.ts's icon-192/512 paths don't currently exist on disk — use
    // the real logo asset instead so the notification icon doesn't 404.
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
