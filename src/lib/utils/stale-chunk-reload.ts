/**
 * Stale Chunk Recovery
 *
 * Every deploy rotates the content hashes under `_next/static/chunks/`. A tab
 * left open across a deploy still holds references to the old hashes, so any
 * later script/dynamic-import fetch for them 404s and (correctly, given our
 * `X-Content-Type-Options: nosniff` header) gets blocked from executing. The
 * fix is simply a fresh page load, which picks up the current build's HTML
 * and manifest — so recover automatically instead of leaving the user stuck.
 *
 * The catch is that a *lost network* produces byte-for-byte the same symptom: a
 * chunk request that never resolves. Reloading then is actively harmful — the
 * document fetch fails too, the service worker hands back its offline page, and
 * the 60s cooldown below leaves the user staring at it with their in-progress
 * screen gone. So when the browser reports itself offline we do not reload; we
 * arm a one-shot reload for the moment connectivity returns.
 */

const STORAGE_KEY = "epidom:stale-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

const STALE_CHUNK_PATTERN =
  /Loading chunk [\w.-]+ failed|ChunkLoadError|Loading CSS chunk|Importing a module script failed/i;

/**
 * A single flag guards the deferred listener. A broken deploy typically fails
 * several chunks in the same tick, and without this every one of them would
 * attach its own `online` handler.
 */
let reconnectReloadArmed = false;

export function isStaleChunkError(message: string | null | undefined): boolean {
  return !!message && STALE_CHUNK_PATTERN.test(message);
}

/** True when the browser is confident there is no network at all. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Defer the recovery reload until the connection is back, at most once. Routing
 * the deferred reload back through `reloadForStaleChunk` keeps it subject to the
 * same cooldown, so a broken deploy on flaky wifi still can't loop.
 */
export function armReloadOnReconnect(): void {
  if (typeof window === "undefined" || reconnectReloadArmed) return;

  reconnectReloadArmed = true;
  window.addEventListener(
    "online",
    () => {
      reconnectReloadArmed = false;
      reloadForStaleChunk();
    },
    { once: true }
  );
}

/**
 * Reload once to pick up the current build. Cooldown-guarded via
 * sessionStorage so a genuinely broken deploy (not just a stale tab) can't
 * trap the page in a reload loop.
 *
 * Returns false without reloading when offline (the reload is deferred to the
 * `online` event instead). Callers such as ErrorBoundary use the return value to
 * decide whether to render their error UI — and offline is exactly the case
 * where the user should see a real error screen rather than a blank one.
 */
export function reloadForStaleChunk(): boolean {
  if (typeof window === "undefined") return false;

  if (isOffline()) {
    armReloadOnReconnect();
    return false;
  }

  const last = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;

  window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  window.location.reload();
  return true;
}
