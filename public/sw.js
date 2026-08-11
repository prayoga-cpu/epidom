// Epidom Service Worker — allowlisted static assets are cached, navigations are
// network-first with an offline fallback page, everything else goes straight to
// the network. Supports offline POS shell loading. Orders use IndexedDB queue
// (idb-keyval), not SW background-sync, for broader browser compatibility
// (including iOS Safari).

// Bump this version on any precached-asset change (e.g. favicon) or any change to
// the caching rules below, so the activate handler purges the old cache and
// install re-precaches fresh copies. v4 = RSC bypass + redirect guards + offline
// fallback; every v3 entry is suspect (it may hold RSC payloads from old builds)
// so the bump is what actually evicts them from users already in the field.
const CACHE_NAME = "epidom-v4";

// Minimal precache: only assets that are stable across builds. /offline.html has
// to live here — it is the last thing between a failed navigation and a dead tab,
// so it can never itself depend on the network being reachable.
const PRECACHE = ["/favicon.ico", "/offline.html"];
const OFFLINE_URL = "/offline.html";

// ---------------------------------------------------------------------------
// Offline app shell — a SEPARATE cache from CACHE_NAME, on purpose.
//
// Dashboard/POS documents carry `Cache-Control: private, no-store` (Next stamps
// it on every dynamically rendered page), so isCacheableResponse correctly
// refuses them for the normal cache. But refusing them everywhere means a
// cashier who loses wifi mid-shift gets the generic offline card instead of
// the POS screen they were standing at — even though the JS chunks and the
// IndexedDB order mirror are both still on the device and the app could boot
// perfectly well. That is a real regression for the one workflow this whole
// feature exists to protect.
//
// Storing them is therefore a deliberate, narrowly-scoped override of that
// header, with three guards that make it safe:
//   1. Written only for /store/** documents — never marketing, auth, checkout,
//      admin, or anything carrying a query string.
//   2. Read ONLY from navigationFallback, i.e. only when the network already
//      failed. While online the live response always wins, so this can never
//      serve stale figures to someone who is connected.
//   3. Held in its own cache so signing out can drop the whole thing in one
//      call without touching the static-asset cache (see CLEAR_APP_SHELL and
//      nav-user.tsx's logout handler). That is what keeps a shared device from
//      showing one owner's dashboard to the next.
// ---------------------------------------------------------------------------
const SHELL_CACHE = "epidom-shell-v1";

/** Caches that survive an activate sweep. Anything else is a stale generation. */
const CURRENT_CACHES = [CACHE_NAME, SHELL_CACHE];

// On localhost (dev) the SW must exist (so Chrome treats the app as installable)
// but must NOT cache — otherwise it serves stale dev chunks and breaks HMR.
const IS_DEV =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

// ---------------------------------------------------------------------------
// Caching policy: explicit ALLOWLIST, not a denylist.
//
// The previous version cached everything same-origin that wasn't a navigation or
// an /api/ route. That default-on posture is what let React Server Component
// payloads (`?_rsc=…`, fetched with mode "cors") into the cache, and after a
// deploy those payloads point at `_next/static` chunk hashes that no longer
// exist — ChunkLoadError, forced reload, the exact symptom users reported. A
// denylist is unmaintainable here because every new dynamic same-origin GET
// (route handlers, RSC, server actions, image optimizer, auth callbacks) is
// opt-out; miss one and it silently rots in the cache for a whole cache
// generation. With an allowlist the failure mode inverts: anything new is
// uncached until someone deliberately adds it, and the only things listed are
// content-addressed or genuinely static, so a stale copy is impossible by
// construction.
// ---------------------------------------------------------------------------
const CACHEABLE_PATH_PREFIXES = [
  "/_next/static/", // content-hashed and immutable (JS, CSS, next/font media)
  "/images/",
  "/payment-logos/",
  "/map-styles/",
  "/fonts/",
];

const CACHEABLE_EXACT_PATHS = [
  "/favicon.ico",
  "/logo.png",
  "/noise-texture.svg",
  OFFLINE_URL,
];

// Self-hosted font files served from anywhere else on the origin.
const CACHEABLE_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"];

// Absolute last resort, used only if even the precached offline page is gone.
// Inline rather than fetched, for obvious reasons.
const LAST_RESORT_HTML =
  '<!doctype html><html lang="fr"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Hors ligne — Epidom</title>" +
  '<body style="margin:0;display:grid;place-items:center;min-height:100dvh;background:#18181b;color:#fafafa;' +
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px">' +
  "<div><p>Vous êtes hors ligne.</p><p>Anda sedang offline.</p><p>You are offline.</p></div>";

function isCacheableAsset(url) {
  const path = url.pathname;
  if (CACHEABLE_EXACT_PATHS.includes(path)) return true;
  if (CACHEABLE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  return CACHEABLE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * App Router client-side navigations and <Link> prefetches are ordinary
 * `fetch()` calls (mode "cors", never "navigate") against the *page* URL with an
 * `_rsc` cache-buster, and they return a React Server Component payload instead
 * of HTML. Those payloads hard-code the `_next/static` chunk hashes of the build
 * that produced them, so replaying one from cache after a deploy hands the
 * router references to chunks that 404 — ChunkLoadError and a forced reload.
 * They are also per-session and per-tenant, so caching them risks showing one
 * store's data to another account on a shared device.
 *
 * Next.js marks these requests several different ways depending on version,
 * prefetch kind and whether the router is doing a segment-level fetch, so check
 * all of them; any hit means the request must bypass the SW entirely.
 */
function isRscRequest(request, url) {
  if (url.searchParams.has("_rsc")) return true;

  const headers = request.headers;
  if (
    headers.get("RSC") ||
    headers.get("Next-Router-Prefetch") ||
    headers.get("Next-Router-State-Tree") ||
    headers.get("Next-Router-Segment-Prefetch")
  ) {
    return true;
  }

  return (headers.get("Accept") || "").includes("text/x-component");
}

/**
 * A response is only safe to persist if it is a real, final, public 200.
 *
 * - `redirected` means fetch followed a 3xx to get here. This app redirects
 *   constantly server-side (src/proxy.ts sends every protected route to /login
 *   without a session, and requirePlan / requireStaffPageAccess / the dashboard
 *   layout all call redirect()), so the cache would fill with /login bodies
 *   stored under dashboard URLs. Worse, replaying a redirected response for a
 *   navigation is a hard failure: navigations use redirect mode "manual" and the
 *   browser rejects the response with a TypeError rather than rendering it.
 * - `opaque` responses (no-cors cross-origin) have status 0 and an unreadable
 *   body, so we can neither validate nor usefully replay them.
 * - `no-store` is the server explicitly saying this body is per-request; Next.js
 *   sends it on every dynamically rendered (i.e. tenant-scoped) page.
 */
function isCacheableResponse(response) {
  if (!response || !response.ok) return false;
  if (response.redirected) return false;
  if (response.type === "opaque" || response.type === "opaqueredirect") return false;
  return !(response.headers.get("Cache-Control") || "").includes("no-store");
}

function putInCache(request, response) {
  const clone = response.clone();
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, clone))
    .catch(() => {
      // Quota exceeded or the cache was purged mid-write — the network response
      // is already on its way to the page, so there is nothing to recover.
    });
}

/**
 * Navigation fallback chain: cache, then the precached offline page, then a
 * synthesized document. The old code ended at `caches.match(request)`, which
 * resolves to `undefined` on a miss — and `respondWith(undefined)` is not a
 * fallback, it is a hard navigation failure showing the browser's own error
 * page. Every branch here resolves to a real Response.
 */
/**
 * Whether this navigation response may be kept as an offline app shell. See
 * the SHELL_CACHE block for the reasoning and the safety guards.
 *
 * `response.ok` and `!redirected` still apply — a login redirect or an error
 * page cached as "the POS screen" would be worse than no shell at all. The
 * query-string exclusion keeps one-off filtered views out of the shell so it
 * stays a small, predictable set of documents.
 */
function isShellCacheable(url, response) {
  if (!response || !response.ok || response.redirected) return false;
  if (response.type === "opaque" || response.type === "opaqueredirect") return false;
  if (url.search) return false;
  return url.pathname.startsWith("/store/");
}

async function putInShellCache(request, response) {
  const copy = response.clone();
  try {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, copy);
  } catch {
    // Storage pressure or private browsing — the shell is an optimisation,
    // never a requirement, so a write failure is not worth surfacing.
  }
}

async function shellCacheMatch(request) {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    // A redirected response must never reach respondWith for a navigation; an
    // entry written by an older worker could still be one.
    return cached && !cached.redirected ? cached : null;
  } catch {
    return null;
  }
}

async function navigationFallback(request) {
  // Wrapped because CacheStorage itself can throw (private browsing, storage
  // pressure, a cache deleted mid-activate). Anything that escapes here would
  // reject respondWith, which is the very failure this function exists to
  // prevent, so degrade to the inline document instead.
  try {
    // The offline app shell comes first: for a dashboard/POS route this is the
    // real page the cashier was on, which beats a generic "you're offline"
    // card by a wide margin — the JS chunks and the IndexedDB mirror are both
    // still on the device, so the app can actually boot and keep taking
    // orders. Only consulted here, in the network-failure path; while online
    // the navigation branch above always serves the live response.
    const shell = await shellCacheMatch(request);
    if (shell) return shell;

    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(request);
    // Belt-and-braces: a redirected response must never reach respondWith for a
    // navigation (see isCacheableResponse), and a cache written by an older
    // worker version may still contain one.
    if (cached && !cached.redirected) return cached;

    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
  } catch {
    // fall through to the inline document below
  }

  return new Response(LAST_RESORT_HTML, {
    status: 503,
    statusText: "Offline",
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Added one by one rather than via addAll(): addAll() rejects the entire
      // install if a single asset 404s, which would leave the previous (stale)
      // worker in control indefinitely — the opposite of what we want.
      Promise.all(PRECACHE.map((path) => cache.add(path).catch(() => {})))
    )
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
            .filter((k) => !CURRENT_CACHES.includes(k))
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

  // RSC payloads and router prefetches: never read, never write, no interception
  // at all. Checked before anything else because these are GETs against ordinary
  // page URLs and would otherwise be indistinguishable from a navigation.
  if (isRscRequest(request, url)) return;

  // Never cache API routes — always go network, let idb-keyval handle offline
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages): network-first, fall back to cache, then to
  // the offline page. Redirects are handed straight back to the browser to
  // follow (a 3xx reaches us as an opaqueredirect because navigations use
  // redirect mode "manual") and are never written to the cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) putInCache(request, response);
          else if (isShellCacheable(url, response)) putInShellCache(request, response);
          return response;
        })
        .catch(() => navigationFallback(request))
    );
    return;
  }

  // Everything else that is not on the allowlist is left to the network. This is
  // the safe default described at the top of the file.
  if (!isCacheableAsset(url)) return;

  // Allowlisted static assets: stale-while-revalidate.
  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(request))
      // If CacheStorage is unavailable at all (private browsing, storage
      // pressure), degrade to a plain cache miss rather than letting the
      // rejection reach respondWith — a rejected respondWith surfaces to the
      // page as a failed asset load, i.e. exactly the ChunkLoadError this
      // rewrite exists to stop manufacturing.
      .catch(() => undefined)
      .then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (isCacheableResponse(response)) putInCache(request, response);
          return response;
        });

        if (cached) {
          // Revalidate in the background. Swallow the failure explicitly:
          // offline is the normal case here and an unhandled rejection in the
          // worker is noise at best, a killed worker at worst.
          networkFetch.catch(() => {});
          return cached;
        }

        return networkFetch;
      })
  );
});

// Lets a page tell a freshly installed worker to take over immediately
// (`registration.waiting.postMessage({ type: "SKIP_WAITING" })`) instead of
// waiting for every tab to close. Relevant here because a lingering old worker
// is precisely what serves stale chunk references after a deploy.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Sign-out drops the offline app shell. Those documents are server-rendered
  // for one specific account, and a POS tablet is very often shared — without
  // this, the next owner to sign in on the same device could be handed the
  // previous one's dashboard the first time the wifi drops. Posted by
  // nav-user.tsx's logout handler; see the SHELL_CACHE block up top.
  if (event.data && event.data.type === "CLEAR_APP_SHELL") {
    event.waitUntil(caches.delete(SHELL_CACHE));
  }
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
