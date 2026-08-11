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

/**
 * Every section that actually exists as a page under
 * src/app/(app)/store/[storeId]/(dashboard)/. Deliberately NOT derived from
 * navigation.config.ts, for two reasons:
 *
 *  1. This module is imported by src/proxy.ts, which runs on the Edge —
 *     navigation.config.ts pulls in a dozen lucide-react components, and
 *     dragging a React icon library into the middleware bundle to answer a
 *     string-shape question would be a bad trade.
 *  2. The two lists are genuinely different sets. The sidebar deliberately
 *     omits pages that are real, reachable routes but not top-level nav
 *     entries (attendance, shifts, changelog) — those are perfectly valid
 *     things to resume onto, so validating against the nav list alone would
 *     bounce a user off a page they were legitimately on.
 *
 * The launcher at /go/[...path] has the opposite requirement (it's building
 * a *new* destination, not honouring one the user already reached), so it
 * validates against navigation.config.ts instead.
 */
const RESUMABLE_STORE_SECTIONS = new Set([
  "/alerts",
  "/attendance",
  "/billing",
  "/changelog",
  "/custom-development",
  "/dashboard",
  "/data",
  "/finance",
  "/management",
  "/menu",
  "/pos",
  "/pos/kds",
  "/pos/orders",
  "/production",
  "/profile",
  "/schedule",
  "/shifts",
  "/staff",
  "/storefront",
  "/tables",
]);

/**
 * App pages that live outside a store context. /admin's children are listed
 * individually rather than prefix-matched so a removed admin sub-page can't
 * keep resolving from a months-old cookie.
 */
const RESUMABLE_ROOT_PATHS = new Set([
  "/profile",
  "/stores",
  "/owner",
  "/admin",
  "/admin/capacity",
  "/admin/custom-development",
  "/admin/feedback",
  "/admin/revenue",
]);

/**
 * Store ids are cuids today, but pinning the exact cuid shape here would
 * silently break every resume the day the id strategy changes. A permissive
 * "opaque token" shape is enough for what this check is actually for:
 * rejecting junk, traversal (".."), and percent-encoded segments that could
 * assemble a URL no route matches.
 */
const STORE_ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

/**
 * Whether `value` is a path the app can actually render right now.
 *
 * isSafeRedirectTarget only answers "is this same-origin?" — it happily
 * passes a path pointing at a store the user sold, a section deleted in a
 * refactor, or a typo'd URL, and every one of those lands the user on a 404
 * the moment they open the app. This is the liveness half of that check:
 * the path has to match a route shape that still exists in the App Router
 * tree. Ownership of the store id is NOT checked here (it can't be — this
 * runs on the Edge with no DB); the (dashboard) layout does that and sends
 * a stale store to /stores.
 *
 * Edge-safe by construction: pure string work, no DOM, no Node APIs.
 */
export function isResumableAppPath(value: string): boolean {
  if (!isSafeRedirectTarget(value)) return false;
  // Browsers normalise a backslash to "/" while parsing a URL, so "/\evil.com"
  // is protocol-relative in practice even though it slips past the "//" test
  // above. Control characters get stripped rather than rejected, which is the
  // same trick by another name — refuse both outright.
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;

  const pathname = value.split(/[?#]/)[0];
  const segments = pathname.split("/").filter(Boolean);
  // "/" is the marketing homepage — resuming onto it is what this whole
  // mechanism exists to avoid, so it is never a valid target.
  if (segments.length === 0) return false;
  // Print views auto-open the browser print dialog and have no navigation
  // behind them; LastVisitedTracker already refuses to save one, but a cookie
  // written before that guard existed can still hold one.
  if (segments[segments.length - 1] === "print") return false;

  if (segments[0] === "store") {
    if (segments.length < 2 || !STORE_ID_PATTERN.test(segments[1])) return false;
    // Bare /store/{id} is a real page now — it redirects to the user's
    // default landing section (see the (dashboard) index page).
    if (segments.length === 2) return true;
    return RESUMABLE_STORE_SECTIONS.has(`/${segments.slice(2).join("/")}`);
  }

  return RESUMABLE_ROOT_PATHS.has(`/${segments.join("/")}`);
}

/**
 * The sections a user is allowed to nominate as "where opening a store drops
 * me". Mirrors the client-side useDefaultLanding() hook — kept here as the
 * server/Edge-safe copy so the store index page and the /go launcher can
 * resolve the same preference without pulling in a React hook.
 */
export const DEFAULT_LANDING_SECTIONS = ["dashboard", "pos", "storefront", "data"] as const;

/** Coerces a raw `User.defaultLanding` value to a section that really exists. */
export function normalizeDefaultLanding(value: unknown): string {
  return typeof value === "string" &&
    (DEFAULT_LANDING_SECTIONS as readonly string[]).includes(value)
    ? value
    : "dashboard";
}
