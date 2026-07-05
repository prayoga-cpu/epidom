/**
 * Last-Seen Version Utility
 *
 * Tracks the app version the user last acknowledged via the "What's new"
 * bell prompt, persisted in localStorage. Mirrors the SSR-guarded, try/catch
 * pattern of cookie-consent.ts so it is safe to call during SSR and in
 * privacy modes where storage may throw.
 */

const LAST_SEEN_VERSION_KEY = "epidom:lastSeenVersion";

/**
 * Get the app version the user last saw, or null if none is stored
 * (or storage is unavailable).
 */
export function getLastSeenVersion(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch (error) {
    return null;
  }
}

/**
 * Record the app version the user has now seen.
 */
export function setLastSeenVersion(v: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, v);
  } catch (error) {}
}
