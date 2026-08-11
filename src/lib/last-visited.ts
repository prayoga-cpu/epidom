// Shared between src/proxy.ts (Edge runtime — no DOM, no "use client") and
// the client-side LastVisitedTracker/ResumeLastVisited/logout handler, so
// the cookie names can't drift between them. The "is this a marketing page"
// check itself isn't duplicated here — src/proxy.ts already computes that
// (isLocalizedMarketingPath) for its own locale-routing logic, and reuses it
// for the redirect below rather than maintaining a second definition.

export const LAST_VISITED_COOKIE = "epidom:lastVisitedUrl";
export const REMEMBER_PREF_COOKIE = "epidom:rememberLastVisited";

/** Rejects anything that isn't a same-origin path, so a tampered cookie
 * value can never turn this into an open redirect (e.g. "//evil.com" or
 * "https://evil.com" being treated as scheme/host-relative by a browser). */
export function isSafeRedirectTarget(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}
