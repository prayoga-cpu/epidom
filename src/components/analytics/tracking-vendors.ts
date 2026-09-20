/**
 * Consent-gated loading of the Google Analytics and Meta Pixel scripts.
 *
 * Nothing here runs on the server. The inline stubs in the two *-script.tsx
 * components define window.gtag / window.fbq without any network request; the
 * vendor scripts themselves (gtag.js, fbevents.js) are only inserted by
 * enable*() below, which the consent bridges call once the matching consent
 * exists: at page load when it is already saved, or the moment it is granted.
 * disable*() is the withdrawal path.
 *
 * Every function is idempotent, so calling sync on every consent event (and on
 * mount) is safe.
 */

import { hasAnalyticsConsent, hasMarketingConsent } from "@/lib/cookie-consent";

// Not secrets: both IDs are visible in every page's network requests. Hardcoded
// fallbacks keep tracking working when the env var is missing on the host (.env
// is gitignored and never deploys); the env vars override them.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-S7DYSLM84X";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821676715464709";

const GTAG_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
const FBEVENTS_SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";
const GTAG_SCRIPT_ID = "epidom-gtag-js";
const FBEVENTS_SCRIPT_ID = "epidom-fbevents-js";

/** Google Analytics (GA4): the measurement cookies it sets on this site's domain. */
const GA_COOKIE = /^(_ga|_ga_.+|_gid|_gat|_gat_.+)$/;
/** Meta Pixel: the first-party cookies it sets on this site's domain. */
const META_COOKIE = /^(_fbp|_fbc)$/;

// The stubs are typed loosely on purpose: analytics.ts already declares a narrower
// `Window.gtag` for its own call sites, and these need `gtag("js", new Date())`.
type LooseFn = (...args: unknown[]) => void;
type Fbq = LooseFn & { callMethod?: LooseFn; queue: unknown[]; loaded?: boolean; push?: unknown };
type TrackingWindow = {
  dataLayer?: unknown[];
  gtag?: LooseFn;
  fbq?: Fbq;
  _fbq?: unknown;
  // `ga-disable-<id>` flags
  [key: string]: unknown;
};

const w = (): TrackingWindow => window as unknown as TrackingWindow;

// Module state, not persisted: a reload starts from "not configured" and the
// scripts are looked up in the DOM, so they are still never inserted twice.
let gaConfigured = false;
let metaInitialised = false;
let metaRevoked = false;

/** Test hook: forget what this module has done in the current page. */
export function resetTrackingVendorState(): void {
  gaConfigured = false;
  metaInitialised = false;
  metaRevoked = false;
}

function injectScriptOnce(id: string, src: string): void {
  if (document.getElementById(id) || document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Same shape as the inline stub: queues calls, makes no network request. */
function ensureGtagStub(): void {
  const win = w();
  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag === "function") return;
  win.gtag = function gtag() {
    // gtag.js reads `arguments` objects off the dataLayer, not arrays.
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer!.push(arguments);
  };
  win.gtag("js", new Date());
}

/** Same shape as Meta's own stub, minus the script insertion. */
function ensureFbqStub(): void {
  const win = w();
  if (win.fbq) return;
  const n = function () {
    // eslint-disable-next-line prefer-rest-params
    if (n.callMethod) n.callMethod.apply(n, arguments as unknown as unknown[]);
    // eslint-disable-next-line prefer-rest-params
    else n.queue.push(arguments);
  } as unknown as Fbq;
  if (!win._fbq) win._fbq = n;
  n.push = n;
  n.loaded = true;
  n.queue = [];
  win.fbq = n;
}

/**
 * Best-effort delete of first-party cookies by name. A cookie is only removed by
 * a Set-Cookie that names the same domain and path it was created with, and GA
 * scopes its cookies to the registrable domain (.epidom.fr), so every parent
 * domain of the host is tried, plus the host-only form. Cookies a vendor sets on
 * its own domain (Meta's `fr`, Google's) are out of reach for the site.
 */
export function deleteCookiesMatching(
  matcher: RegExp,
  hostname: string = window.location.hostname
): void {
  const names = document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0].trim())
    .filter((name) => name && matcher.test(name));
  if (names.length === 0) return;

  const labels = hostname.split(".");
  const domains: Array<string | null> = [null, hostname];
  // Stop before the last label so a bare TLD is never attempted.
  for (let i = 0; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join(".")}`);

  for (const name of names) {
    for (const domain of domains) {
      document.cookie =
        `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/` +
        (domain ? `; domain=${domain}` : "");
    }
  }
}

export function enableGoogleAnalytics(): void {
  if (typeof window === "undefined") return;
  ensureGtagStub();
  w()[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  injectScriptOnce(GTAG_SCRIPT_ID, GTAG_SCRIPT_SRC);
  if (!gaConfigured) {
    w().gtag!("config", GA_MEASUREMENT_ID);
    gaConfigured = true;
  }
}

export function disableGoogleAnalytics(): void {
  if (typeof window === "undefined") return;
  // Google's documented opt-out switch: honoured by gtag.js from the next hit on,
  // including its automatic ones (scroll, outbound clicks), which do not go
  // through trackEvent() and so are not covered by its consent check.
  w()[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  deleteCookiesMatching(GA_COOKIE);
}

export function enableMetaPixel(): void {
  if (typeof window === "undefined") return;
  ensureFbqStub();
  const fbq = w().fbq!;
  if (metaRevoked) {
    fbq("consent", "grant");
    metaRevoked = false;
  }
  if (!metaInitialised) {
    fbq("init", META_PIXEL_ID);
    fbq("track", "PageView");
    metaInitialised = true;
  }
  injectScriptOnce(FBEVENTS_SCRIPT_ID, FBEVENTS_SCRIPT_SRC);
}

export function disableMetaPixel(): void {
  if (typeof window === "undefined") return;
  if (typeof w().fbq === "function") {
    w().fbq!("consent", "revoke");
    metaRevoked = true;
  }
  deleteCookiesMatching(META_COOKIE);
}

/** Make Google Analytics match the saved analytics consent. */
export function syncGoogleAnalytics(): void {
  if (hasAnalyticsConsent()) enableGoogleAnalytics();
  else disableGoogleAnalytics();
}

/** Make the Meta Pixel match the saved marketing consent. */
export function syncMetaPixel(): void {
  if (hasMarketingConsent()) enableMetaPixel();
  else disableMetaPixel();
}
