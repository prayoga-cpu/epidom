/**
 * The first-party copy of the site's Meta Pixel traffic, shown on /admin/pixel.
 *
 * Every Meta Pixel event the site sends (src/lib/analytics.ts, the PageView in
 * src/components/analytics/tracking-vendors.ts, public/sales-pages/pixel.js) is
 * also sent here, and so is every answer to the cookie bar. Meta's Events
 * Manager stays the reference for what Meta received (ad blockers can stop a
 * Meta request and not ours, or the reverse); this is what the site sent, kept
 * where the team can read it without access to the Meta business.
 *
 * Nothing identifies the visitor: no user id, no cookie value, and the server
 * stores no IP. Pixel events are only sent once marketing consent exists,
 * because they are sent from the same place as the pixel call.
 *
 * public/sales-pages/pixel.js repeats the endpoint and the event names in plain
 * JavaScript; keep them in step (src/lib/__tests__/sales-page-pixel.test.ts
 * checks the pixel ID and the endpoint).
 */

/** The Meta events the site sends, in funnel order (the admin page lists them so). */
export const PIXEL_EVENTS = [
  "PageView",
  "ViewContent",
  "SignUpClick",
  "CompleteRegistration",
  "Contact",
  "Lead",
  "InitiateCheckout",
  "StartTrial",
  "Subscribe",
] as const;

export type PixelEventName = (typeof PIXEL_EVENTS)[number];

/** The three ways to answer the cookie bar. */
export const CONSENT_CHOICES = ["ACCEPT_ALL", "REJECT_ALL", "CUSTOM"] as const;

export type ConsentChoice = (typeof CONSENT_CHOICES)[number];

/** Where an event came from: the Next.js site, or a static sales page. */
export const TRACKING_SOURCES = ["site", "sales_page"] as const;

export type TrackingSource = (typeof TRACKING_SOURCES)[number];

export const TRACKING_LOCALES = ["fr", "en", "id"] as const;

export type TrackingLocale = (typeof TRACKING_LOCALES)[number];

export const TRACKING_EVENTS_ENDPOINT = "/api/public/tracking-events";

export type TrackingEventPayload =
  | {
      kind: "PIXEL";
      name: PixelEventName;
      path: string;
      source: TrackingSource;
      locale?: TrackingLocale;
      content?: string;
      value?: number;
      currency?: string;
    }
  | {
      kind: "CONSENT";
      name: ConsentChoice;
      path: string;
      source: TrackingSource;
      locale?: TrackingLocale;
      marketing: boolean;
      analytics: boolean;
    };

/** A uuid, or a cuid-like id: 20+ letters and digits with at least one digit. */
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[a-z0-9]*\d)[a-z0-9]{20,})$/i;

/**
 * The path as the report groups it: no query string or hash, a storefront's
 * slug and any record id collapsed, so "/store/clx…/pos" and every merchant's
 * "/@slug" are one row each and no id is stored.
 */
export function normalizeTrackedPath(raw: string): string {
  let path = (raw.split(/[?#]/)[0] || "/").trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/^\/@[^/]+/, "/@:store");
  path = path
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
  return path.slice(0, 200);
}

/** The page's language from <html lang>, when it is one of the site's. */
export function currentTrackingLocale(): TrackingLocale | undefined {
  if (typeof document === "undefined") return undefined;
  const lang = (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase();
  return (TRACKING_LOCALES as readonly string[]).includes(lang)
    ? (lang as TrackingLocale)
    : undefined;
}

/**
 * Send one event to the first-party log. Fire and forget: sendBeacon survives
 * the navigation that often follows (a Stripe redirect, a sign-up link), and a
 * failure never reaches the visitor.
 */
export function sendTrackingEvent(event: TrackingEventPayload): void {
  if (typeof window === "undefined") return;
  let body: string;
  try {
    body = JSON.stringify(event);
  } catch {
    return;
  }
  // Separate attempts: a sendBeacon that throws still leaves the fetch.
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(TRACKING_EVENTS_ENDPOINT, new Blob([body], { type: "application/json" }))
    ) {
      return;
    }
  } catch {
    // Fall through to fetch.
  }
  try {
    if (typeof fetch === "function") {
      void fetch(TRACKING_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Logging must never break the page.
  }
}

/** The current page's path and language, for an event sent from the Next.js site. */
export function sitePageContext(): { path: string; source: "site"; locale?: TrackingLocale } {
  return {
    path: normalizeTrackedPath(typeof window === "undefined" ? "/" : window.location.pathname),
    source: "site",
    locale: currentTrackingLocale(),
  };
}
