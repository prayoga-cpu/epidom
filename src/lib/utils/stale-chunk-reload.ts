/**
 * Stale Chunk Recovery
 *
 * Every deploy rotates the content hashes under `_next/static/chunks/`. A tab
 * left open across a deploy still holds references to the old hashes, so any
 * later script/dynamic-import fetch for them 404s and (correctly, given our
 * `X-Content-Type-Options: nosniff` header) gets blocked from executing. The
 * fix is simply a fresh page load, which picks up the current build's HTML
 * and manifest — so recover automatically instead of leaving the user stuck.
 */

const STORAGE_KEY = "epidom:stale-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

const STALE_CHUNK_PATTERN =
  /Loading chunk [\w.-]+ failed|ChunkLoadError|Loading CSS chunk|Importing a module script failed/i;

export function isStaleChunkError(message: string | null | undefined): boolean {
  return !!message && STALE_CHUNK_PATTERN.test(message);
}

/**
 * Reload once to pick up the current build. Cooldown-guarded via
 * sessionStorage so a genuinely broken deploy (not just a stale tab) can't
 * trap the page in a reload loop.
 */
export function reloadForStaleChunk(): boolean {
  if (typeof window === "undefined") return false;

  const last = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;

  window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  window.location.reload();
  return true;
}
