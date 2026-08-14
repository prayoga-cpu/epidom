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
// v5 = shell/chunk warming + /go launcher fallback (see below).
const CACHE_NAME = "epidom-v5";

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

// ---------------------------------------------------------------------------
// Offline launcher for /go/*.
//
// The manifest's start_url is /go/dashboard and its long-press shortcuts are
// /go/pos and /go/pos/orders — a server-side launcher that resolves *which*
// store this session belongs to and redirects to /store/{id}/… (a static
// manifest cannot contain a store id). Server-side means it needs the network,
// which means a cold launch of the installed app with no signal died on the
// very first hop: the redirect never happens, navigationFallback finds nothing
// cached under /go/dashboard (redirects are never cached, deliberately), and
// the cashier gets the generic offline card instead of the POS screen. That is
// the installed app being unusable offline no matter how much data is mirrored
// on the device.
//
// This is the offline half of that launcher: a self-contained document that
// resolves the destination client-side from the same last-visited value the
// server launcher reads (LastVisitedTracker writes it to both localStorage and
// a cookie — see src/components/providers/last-visited-tracker.tsx), then
// replaces itself with that URL so the shell cache can serve the real page.
// Only reachable from the network-failure path; while online the server
// launcher always wins.
// ---------------------------------------------------------------------------
const LAST_VISITED_KEY = "epidom:lastVisitedUrl";

/**
 * `section` is what the user actually tapped (`/go/pos` → `/pos`), `saved` is
 * every page currently in the shell cache. Handing both to the document lets
 * it aim at a destination that will really render instead of one that merely
 * sounds right: last-visited first, then the tapped shortcut, then anything
 * saved at all, then the offline card.
 *
 * Split so the literal "</script>" never appears in this file — harmless in a
 * .js response, but it would terminate the block early in any context that
 * parses this text as HTML.
 */
function goLauncherHtml(section, saved) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Epidom</title><body style="margin:0;background:#18181b">
<script>(function(){
  var saved = ${JSON.stringify(saved)};
  var section = ${JSON.stringify(section)};

  function lastVisited(){
    try{ var v = localStorage.getItem(${JSON.stringify(LAST_VISITED_KEY)}); if(v) return v; }catch(e){}
    try{
      var m = document.cookie.match(/(?:^|;\\s*)epidom:lastVisitedUrl=([^;]*)/);
      if(m) return m[1];
    }catch(e){}
    return "";
  }

  // Same-origin store path only. A tampered cookie must never turn the offline
  // launcher into an open redirect, and nothing outside /store/ has an offline
  // shell behind it anyway.
  function safe(path){
    return typeof path === "string" && path.indexOf("/store/") === 0 &&
      path.indexOf("//") !== 0 && !/[\\s\\\\]/.test(path);
  }

  var raw = lastVisited(), target = "";
  try{ target = decodeURIComponent(raw); }catch(e){ target = raw; }
  var bare = target.split("?")[0].split("#")[0];

  var destination = "";
  // Nothing saved at all (a device that has never synced) is the one case where
  // trusting last-visited blindly is still right — there is no better guess,
  // and the shell cache may simply be unreadable rather than empty.
  if (safe(target) && (saved.length === 0 || saved.indexOf(bare) !== -1)) {
    destination = target;
  } else {
    for (var i = 0; i < saved.length; i++) {
      if (section && saved[i].slice(-section.length) === section) { destination = saved[i]; break; }
    }
    if (!destination && saved.length && safe(saved[0])) destination = saved[0];
  }

  location.replace(destination || "/offline.html");
})();<` + `/script>`;
}

/**
 * Chunk references inside a server-rendered document.
 *
 * Warming the shell without these is warming half a page: the HTML is on the
 * device but every `_next/static` bundle it boots from is still a network
 * request, so opening it offline gets a ChunkLoadError instead of an app. Next
 * emits those paths in <script src>, <link href> and inside the inlined flight
 * payload, so a scan of the raw text catches all three without parsing HTML.
 */
const NEXT_ASSET_PATTERN = /\/_next\/static\/[A-Za-z0-9._%\-/]+/g;

/** Warm-up destinations we refuse outright, whatever the caller asked for. */
function isWarmablePath(path) {
  return path.startsWith("/store/") && !path.endsWith("/print");
}

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

/** Pathnames currently held in the offline app-shell cache. */
async function listShellPaths() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const requests = await cache.keys();
    return requests.map((request) => new URL(request.url).pathname);
  } catch {
    // An unreadable CacheStorage reads as "nothing saved", which is the honest
    // answer for every caller here.
    return [];
  }
}

async function shellCacheMatch(request) {
  try {
    const cache = await caches.open(SHELL_CACHE);
    // `ignoreVary` because Next stamps every page with
    // `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url`, and
    // default matching then requires those headers to agree between the request
    // that *wrote* the entry and the one reading it. A warmed entry (written by
    // WARM_SHELL's own fetch) and a real navigation differ on exactly that
    // axis, so without this every warmed page silently misses. Safe here
    // because this cache only ever holds full HTML documents — the RSC variants
    // those Vary headers exist to distinguish never enter it (see isRscRequest,
    // which bypasses the worker entirely).
    const cached = await cache.match(request, { ignoreVary: true });
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
    // A failed /go/* hop is a cold launch of the installed app with no signal.
    // Resolve it on-device instead of dead-ending — see goLauncherHtml.
    const path = new URL(request.url).pathname;
    if (path.startsWith("/go/")) {
      return new Response(goLauncherHtml(path.slice(3), await listShellPaths()), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

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

// ---------------------------------------------------------------------------
// Shell warming — the difference between "offline mode is on" and "this page
// opens offline".
//
// Until now the shell cache filled only as a side effect of real navigations,
// and in an App Router SPA a real navigation happens roughly once: the first
// load. Every screen change after that is an RSC fetch, which this worker
// deliberately ignores. So a cashier who opened the dashboard and then clicked
// through to POS had exactly one page saved — the dashboard — and losing signal
// on the POS screen dropped them onto the offline card anyway. Warming makes
// the set explicit: the app names the pages it wants openable offline, and this
// fetches each one plus the `_next/static` bundles it boots from.
// ---------------------------------------------------------------------------

/** Caches every `_next/static` bundle referenced by a warmed document. */
async function warmChunks(html) {
  const paths = new Set();
  for (const raw of html.match(NEXT_ASSET_PATTERN) || []) {
    if (raw.endsWith(".map")) continue;
    paths.add(raw);
  }
  if (paths.size === 0) return 0;

  let stored = 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      [...paths].map(async (path) => {
        try {
          // Content-hashed, so an entry that already exists is by definition
          // the right one — re-fetching it would be pure waste on a connection
          // we are explicitly treating as scarce.
          if (await cache.match(path)) {
            stored++;
            return;
          }
          const response = await fetch(path, { credentials: "same-origin" });
          if (!isCacheableResponse(response)) return;
          await cache.put(path, response);
          stored++;
        } catch {
          // One missing bundle shouldn't fail the whole warm-up.
        }
      })
    );
  } catch {
    return stored;
  }
  return stored;
}

async function warmShellPath(path) {
  let url;
  try {
    url = new URL(path, self.location.origin);
  } catch {
    return { path, ok: false, reason: "rejected" };
  }
  if (url.origin !== self.location.origin || url.search || !isWarmablePath(url.pathname)) {
    return { path, ok: false, reason: "rejected" };
  }

  let response;
  try {
    response = await fetch(url.href, {
      credentials: "same-origin",
      headers: { Accept: "text/html,application/xhtml+xml" },
      // Never warm from the HTTP cache: a body that predates the current deploy
      // would pin chunk hashes that no longer exist, which is the exact
      // ChunkLoadError this worker's allowlist exists to avoid manufacturing.
      cache: "no-cache",
    });
  } catch {
    return { path, ok: false, reason: "offline" };
  }

  if (!isShellCacheable(url, response)) {
    // `redirected` here is almost always the session being gone (proxy.ts sends
    // every protected route to /login), which is worth telling the UI apart
    // from a genuine server error.
    return {
      path,
      ok: false,
      reason: response.redirected ? "auth" : `http-${response.status}`,
    };
  }

  let html = "";
  try {
    html = await response.clone().text();
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(new Request(url.href), response);
  } catch {
    return { path, ok: false, reason: "storage" };
  }

  return { path, ok: true, assets: await warmChunks(html) };
}

async function warmShell(paths) {
  // Sequential on purpose. These are full server-rendered dashboard documents
  // and the warm-up runs on whatever connection the device has left; firing
  // eight of them at once is how you turn a weak signal into eight timeouts.
  const results = [];
  for (const path of paths) {
    results.push(await warmShellPath(path));
  }
  return results;
}

/** Everything the Offline & Sync panel needs to describe this device honestly. */
async function collectOfflineStatus() {
  const status = {
    cacheVersion: CACHE_NAME,
    devPassthrough: IS_DEV,
    shellPaths: await listShellPaths(),
    assetCount: 0,
    offlinePageReady: false,
  };

  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    status.assetCount = requests.length;
    status.offlinePageReady = requests.some(
      (request) => new URL(request.url).pathname === OFFLINE_URL
    );
  } catch {
    // Same.
  }

  return status;
}

/** Answers a `postMessage` sent with a MessageChannel port; no-op without one. */
function replyToMessage(event, payload) {
  const port = event.ports && event.ports[0];
  if (port) port.postMessage(payload);
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

  // Offline & Sync panel: "what is actually on this device right now".
  if (event.data && event.data.type === "GET_OFFLINE_STATUS") {
    event.waitUntil(collectOfflineStatus().then((status) => replyToMessage(event, status)));
  }

  // Offline & Sync panel / offline-mode priming: make these pages openable
  // without a connection. Capped so a malformed caller can't queue an unbounded
  // crawl of the app.
  if (event.data && event.data.type === "WARM_SHELL") {
    const paths = Array.isArray(event.data.paths) ? event.data.paths.slice(0, 24) : [];
    event.waitUntil(
      // On localhost the fetch handler serves nothing from cache (see IS_DEV),
      // so warming there would fill storage with entries that can never be
      // read and report a readiness the device does not have. Refuse, and say
      // why — the panel surfaces this verbatim.
      (IS_DEV
        ? Promise.resolve(paths.map((path) => ({ path, ok: false, reason: "dev" })))
        : warmShell(paths)
      ).then((results) => replyToMessage(event, { devPassthrough: IS_DEV, results }))
    );
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
    // The icon-192 assets referenced by manifest.ts do exist now, so the note
    // that used to sit here (pointing both of these at /logo.png as a 404
    // workaround) is stale. /logo.png is a 119 KB full-colour mark; the
    // maskable 192 is 6 KB and already shaped for a circular badge mask.
    icon: "/images/icon-192.png",
    badge: "/images/icon-192-maskable.png",
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
