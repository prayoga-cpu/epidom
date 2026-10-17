import type { NextRequest, NextResponse } from "next/server";

/**
 * Where the cookie bar is needed.
 *
 * Analytics and advertising cookies need the visitor's consent first in the
 * European Union, the EEA, the United Kingdom and Switzerland (and the places
 * under the same rules). Everywhere else they are on from the first visit,
 * and "Manage cookies" (site footer, sales pages) still turns them off.
 *
 * - The proxy reads the visitor's country from Vercel's `x-vercel-ip-country`
 *   header and sets CONSENT_MODE_COOKIE on the response ("opt-in" = ask
 *   first, "opt-out" = on by default), so the page knows before it loads.
 * - CONSENT_BOOT_SCRIPT (root layout, before anything else runs) and
 *   public/sales-pages/pixel.js read it: with "opt-out" and no saved choice
 *   they save an automatic one (`auto: true`) and no bar is shown; with
 *   "opt-in" they drop an automatic choice, so a visitor now browsing from the
 *   EU is asked. A choice the visitor made themselves is never touched.
 * - No country (local development, a request the proxy didn't see) counts as
 *   "opt-in": when in doubt, ask.
 *
 * To ask in another country, add its ISO 3166-1 alpha-2 code below.
 */
export const CONSENT_REQUIRED_COUNTRIES: ReadonlySet<string> = new Set([
  // European Union
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EU outermost regions with their own country codes (French overseas departments, Saint-Martin)
  "GF", "GP", "MQ", "RE", "YT", "MF",
  // European Economic Area
  "IS", "LI", "NO",
  // United Kingdom and the Crown dependencies, Gibraltar
  "GB", "GG", "JE", "IM", "GI",
  // Switzerland
  "CH",
]);

export type ConsentMode = "opt-in" | "opt-out";

/** Set by the proxy, read by CONSENT_BOOT_SCRIPT and public/sales-pages/pixel.js (keep the name in step). */
export const CONSENT_MODE_COOKIE = "epidom_consent_mode";

/** Kept for a week; the proxy refreshes it whenever the country's answer changes. */
const CONSENT_MODE_MAX_AGE = 7 * 24 * 60 * 60;

/** Codes some geolocation services send for "not a country" (EU-wide, unknown, Tor): treated as unknown. */
const NOT_A_COUNTRY: ReadonlySet<string> = new Set(["EU", "XX", "ZZ", "T1", "A1", "A2", "O1", "AP"]);

/** "opt-in" for the countries that require consent and for an unknown country. */
export function consentModeForCountry(country: string | null | undefined): ConsentMode {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]$/.test(code) || NOT_A_COUNTRY.has(code)) return "opt-in";
  return CONSENT_REQUIRED_COUNTRIES.has(code) ? "opt-in" : "opt-out";
}

/** The visitor's country from the hosting platform's geolocation header, if any. */
export function requestCountry(req: Pick<NextRequest, "headers">): string | null {
  return req.headers.get("x-vercel-ip-country");
}

/**
 * Put the consent mode for the visitor's country on a response, only when it
 * differs from the one the browser already has (so most responses carry no
 * Set-Cookie). Not httpOnly: the page reads it. No identifier, only the mode.
 */
export function applyConsentModeCookie(
  req: Pick<NextRequest, "headers" | "cookies" | "nextUrl">,
  response: Pick<NextResponse, "cookies">
): void {
  const mode = consentModeForCountry(requestCountry(req));
  if (req.cookies.get(CONSENT_MODE_COOKIE)?.value === mode) return;
  response.cookies.set(CONSENT_MODE_COOKIE, mode, {
    path: "/",
    maxAge: CONSENT_MODE_MAX_AGE,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    httpOnly: false,
  });
}

/**
 * Runs in <head> before React and the pixel bridge (see the root layout), so
 * the bridges and the cookie bar already see the right state on their first
 * render. Writes the same record as src/lib/cookie-consent.ts, version 1.0.0.
 *
 * The automatic record carries the language the app would have picked without
 * it (getLanguagePreference: the legacy keys, then the browser's language),
 * because a record's language wins over both.
 *
 * Not on a merchant's storefront or a receipt: their visitors are the
 * merchant's customers, not Epidom's, so the pixel is never switched on for
 * them by default.
 */
export const CONSENT_BOOT_SCRIPT = `!function(){try{
var p=location.pathname;if(p.indexOf("/@")===0||p.indexOf("/r/")===0)return;
var m=document.cookie.match(/(?:^|; )${CONSENT_MODE_COOKIE}=([^;]+)/),mode=m?m[1]:"opt-in";
var K="cookie-consent-preferences",raw=localStorage.getItem(K),rec=null;
try{rec=raw?JSON.parse(raw):null}catch(e){}
if(rec&&rec.version!=="1.0.0")rec=null;
if(mode==="opt-out"){if(rec)return;
var l=localStorage.getItem("locale")||localStorage.getItem("lang");
if(l!=="en"&&l!=="fr"&&l!=="id"){var n=(navigator.language||"").toLowerCase();l=n.indexOf("id")===0?"id":n.indexOf("fr")===0?"fr":"en"}
localStorage.setItem(K,JSON.stringify({essential:true,analytics:true,marketing:true,language:l,timestamp:Date.now(),version:"1.0.0",auto:true}));
window.__epidomAutoConsent=true}
else if(rec&&rec.auto===true){localStorage.removeItem(K)}
}catch(e){}}();`;
