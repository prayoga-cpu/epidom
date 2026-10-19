import type { NextRequest, NextResponse } from "next/server";
import {
  SALES_PAGE_COOKIE,
  isSalesPage,
  isSalesPageLocale,
  salesPageFromCookieHeader,
  type SalesPage,
  type SalesPageLocale,
} from "@/lib/sales-pages";
import { sharedCookieDomainForHost } from "@/lib/auth/cookies";
import { isLikelyBot } from "@/lib/i18n-routing";

/**
 * Where a sign-up came from.
 *
 * The proxy (src/proxy.ts) writes two first-party cookies on page responses:
 *
 * - SOURCE_COOKIE: the last referral link (`?ref=CODE` on a landing page) or
 *   sales page (/sales-page-N, any language) this browser opened. A new one
 *   replaces the old one, so at sign-up it names where the person signed up
 *   from, and that is who the account is credited to, for good.
 * - TOUCH_COOKIE: the campaign tags (utm_*) of the last tagged visit, whether
 *   it was an ad click (fbclid / gclid / ttclid: only the fact, never the id),
 *   where it landed and the site it came from.
 *
 * It also writes SALES_PAGE_COOKIE server-side on a sales page: Safari caps a
 * cookie written by page script (public/sales-pages/tracker.js) at 7 days, or
 * 24 h after an ad click, and a server-set one lasts the full 30.
 *
 * When an account is created, the Better Auth hook (src/lib/auth.ts) turns them
 * into a SignupAttribution row (src/lib/services/signup-attribution.service.ts).
 * Kept free of Prisma and Better Auth: the proxy loads this module.
 */

export const SOURCE_COOKIE = "epidom_source";
export const TOUCH_COOKIE = "epidom_touch";

/** 30 days, the same as SALES_PAGE_COOKIE. */
export const ATTRIBUTION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Unprefixed paths a referral link may point at. Anywhere else `?ref=` is
 * ignored, so a hand-edited /sales-page-2?ref=X can't take a sign-up from the
 * page's owner.
 */
export const REFERRAL_LANDING_PATHS: ReadonlySet<string> = new Set(["/", "/register", "/pricing"]);

const REF_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

/** A referral code as stored: trimmed, upper case, 3–32 of A–Z 0–9 _ -. Null when it isn't one. */
export function normalizeRefCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return REF_CODE_PATTERN.test(code) ? code : null;
}

export type AttributionSource =
  | { kind: "ref"; code: string; at: number }
  | { kind: "page"; page: SalesPage; locale: SalesPageLocale; at: number };

/** "ref.BOB.1760000000" or "page.sales-page-2.en.1760000000" (seconds). */
export function serializeSource(source: AttributionSource): string {
  return source.kind === "ref"
    ? `ref.${source.code}.${source.at}`
    : `page.${source.page}.${source.locale}.${source.at}`;
}

export function parseSource(value: string | null | undefined): AttributionSource | null {
  if (!value) return null;
  const parts = value.split(".");
  const at = Number(parts[parts.length - 1]);
  if (!Number.isInteger(at) || at <= 0) return null;
  if (parts[0] === "ref" && parts.length === 3) {
    const code = normalizeRefCode(parts[1]);
    return code ? { kind: "ref", code, at } : null;
  }
  if (parts[0] === "page" && parts.length === 4) {
    const [, page, locale] = parts;
    return isSalesPage(page) && isSalesPageLocale(locale)
      ? { kind: "page", page, locale, at }
      : null;
  }
  return null;
}

export type AdClick = "meta" | "google" | "tiktok";

export interface AttributionTouch {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** The visit came from an ad click (its click id was in the URL). */
  adClick?: AdClick;
  /** Path the tagged visit landed on, without its query. */
  landingPath: string;
  /** Host of the site the tagged visit came from. */
  referrerHost?: string;
  /** Seconds. */
  at: number;
}

const TAG_FIELDS = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const;
const TAG_PARAMS: Record<(typeof TAG_FIELDS)[number], string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
};

/** Printable text only, at most `max` characters; undefined when nothing is left. */
function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
  return text || undefined;
}

function adClickFrom(params: URLSearchParams): AdClick | undefined {
  if (params.get("fbclid")) return "meta";
  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) return "google";
  if (params.get("ttclid")) return "tiktok";
  return undefined;
}

/** The referring site's host when it isn't this site (apex and www count as this site). */
function externalReferrerHost(referer: string | null, ownHost: string): string | undefined {
  if (!referer) return undefined;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    const bare = (h: string) => h.replace(/^www\./, "");
    return host && bare(host) !== bare(ownHost.toLowerCase()) ? clean(host) : undefined;
  } catch {
    return undefined;
  }
}

/** The touch a request brings, or null when its URL has no campaign tag and no ad click id. */
export function touchFromRequest(
  url: URL,
  referer: string | null,
  now: number = Date.now()
): AttributionTouch | null {
  const params = url.searchParams;
  const touch: AttributionTouch = {
    landingPath: clean(url.pathname) ?? "/",
    at: Math.floor(now / 1000),
  };
  let tagged = false;
  for (const field of TAG_FIELDS) {
    const value = clean(params.get(TAG_PARAMS[field]));
    if (value) {
      touch[field] = value;
      tagged = true;
    }
  }
  const adClick = adClickFrom(params);
  if (adClick) touch.adClick = adClick;
  if (!tagged && !adClick) return null;
  const referrerHost = externalReferrerHost(referer, url.hostname);
  if (referrerHost) touch.referrerHost = referrerHost;
  return touch;
}

/** Whether two touches carry the same tags (a reload, or the sales page's tags forwarded to /register). */
export function sameTags(a: AttributionTouch, b: AttributionTouch): boolean {
  return TAG_FIELDS.every((f) => a[f] === b[f]) && a.adClick === b.adClick;
}

/** Short keys: the cookie travels on every request for 30 days. */
export function serializeTouch(touch: AttributionTouch): string {
  return JSON.stringify({
    s: touch.utmSource,
    m: touch.utmMedium,
    c: touch.utmCampaign,
    ct: touch.utmContent,
    t: touch.utmTerm,
    a: touch.adClick,
    l: touch.landingPath,
    r: touch.referrerHost,
    at: touch.at,
  });
}

export function parseTouch(value: string | null | undefined): AttributionTouch | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return null;
    const at = Number(raw.at);
    if (!Number.isInteger(at) || at <= 0) return null;
    const adClick =
      raw.a === "meta" || raw.a === "google" || raw.a === "tiktok" ? raw.a : undefined;
    const touch: AttributionTouch = { landingPath: clean(raw.l) ?? "/", at };
    const values = {
      utmSource: raw.s,
      utmMedium: raw.m,
      utmCampaign: raw.c,
      utmContent: raw.ct,
      utmTerm: raw.t,
    };
    for (const field of TAG_FIELDS) {
      const v = clean(values[field]);
      if (v) touch[field] = v;
    }
    if (adClick) touch.adClick = adClick;
    const referrerHost = clean(raw.r);
    if (referrerHost) touch.referrerHost = referrerHost;
    return touch;
  } catch {
    return null;
  }
}

/**
 * Put the attribution cookies a page response needs on it (see the top of
 * this file). The proxy calls it for page responses only: never for /api,
 * never on a redirect (the page it leads to keeps the query and sets them).
 * Bots never get them.
 */
export function applyAttributionCookies(
  req: Pick<NextRequest, "headers" | "cookies" | "nextUrl">,
  response: Pick<NextResponse, "cookies">,
  route: { basePath: string; locale: string },
  now: number = Date.now()
): void {
  if (isLikelyBot(req.headers.get("user-agent"))) return;

  const options = {
    path: "/",
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: req.nextUrl.protocol === "https:",
    // Not httpOnly: the referral banner reads SOURCE_COOKIE, and tracker.js
    // must still be able to rewrite SALES_PAGE_COOKIE.
    httpOnly: false,
    domain: sharedCookieDomainForHost(req.nextUrl.hostname),
  };
  const at = Math.floor(now / 1000);
  const current = parseSource(req.cookies.get(SOURCE_COOKIE)?.value);

  const page = route.basePath.slice(1);
  if (isSalesPage(page)) {
    const locale: SalesPageLocale = isSalesPageLocale(route.locale) ? route.locale : "fr";
    if (!(current?.kind === "page" && current.page === page && current.locale === locale)) {
      response.cookies.set(
        SOURCE_COOKIE,
        serializeSource({ kind: "page", page, locale, at }),
        options
      );
    }
    const pageValue = `${page}.${locale}`;
    if (req.cookies.get(SALES_PAGE_COOKIE)?.value !== pageValue) {
      response.cookies.set(SALES_PAGE_COOKIE, pageValue, options);
    }
  } else if (REFERRAL_LANDING_PATHS.has(route.basePath)) {
    const code = normalizeRefCode(req.nextUrl.searchParams.get("ref"));
    if (code && !(current?.kind === "ref" && current.code === code)) {
      response.cookies.set(SOURCE_COOKIE, serializeSource({ kind: "ref", code, at }), options);
    }
  }

  const touch = touchFromRequest(req.nextUrl, req.headers.get("referer"), now);
  if (touch) {
    const existing = parseTouch(req.cookies.get(TOUCH_COOKIE)?.value);
    if (!existing || !sameTags(existing, touch)) {
      response.cookies.set(TOUCH_COOKIE, serializeTouch(touch), options);
    }
  }
}

/** One cookie's value from a raw Cookie header, URI-decoded (Next encodes what it sets). */
export function cookieFromHeader(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1 || pair.slice(0, eq).trim() !== name) continue;
    const raw = pair.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** The fields a SignupAttribution row is created with (string unions match the Prisma enums). */
export interface SignupAttributionData {
  source: "REFERRAL_LINK" | "SALES_PAGE" | null;
  sourceAt: Date | null;
  refCode: string | null;
  salesPage: string | null;
  salesPageLocale: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  adClick: AdClick | null;
  /** Meta's _fbc cookie: only there when the visitor allowed marketing cookies. */
  fbc: string | null;
  landingPath: string | null;
  referrerHost: string | null;
  touchedAt: Date | null;
}

/**
 * What the cookies on a sign-up request say about where it came from. With no
 * SOURCE_COOKIE (a browser from before it existed), the sales page in
 * SALES_PAGE_COOKIE still counts.
 */
export function attributionFromCookieHeader(
  cookieHeader: string | null | undefined
): SignupAttributionData {
  const source = parseSource(cookieFromHeader(cookieHeader, SOURCE_COOKIE));
  const fallbackPage = source ? null : salesPageFromCookieHeader(cookieHeader);
  const touch = parseTouch(cookieFromHeader(cookieHeader, TOUCH_COOKIE));
  const seconds = (s: number | undefined) => (s ? new Date(s * 1000) : null);

  return {
    source:
      source?.kind === "ref"
        ? "REFERRAL_LINK"
        : source?.kind === "page" || fallbackPage
          ? "SALES_PAGE"
          : null,
    sourceAt: seconds(source?.at),
    refCode: source?.kind === "ref" ? source.code : null,
    salesPage: source?.kind === "page" ? source.page : (fallbackPage?.page ?? null),
    salesPageLocale: source?.kind === "page" ? source.locale : (fallbackPage?.locale ?? null),
    utmSource: touch?.utmSource ?? null,
    utmMedium: touch?.utmMedium ?? null,
    utmCampaign: touch?.utmCampaign ?? null,
    utmContent: touch?.utmContent ?? null,
    utmTerm: touch?.utmTerm ?? null,
    adClick: touch?.adClick ?? null,
    fbc: clean(cookieFromHeader(cookieHeader, "_fbc"), 255) ?? null,
    landingPath: touch?.landingPath ?? null,
    referrerHost: touch?.referrerHost ?? null,
    touchedAt: seconds(touch?.at),
  };
}
