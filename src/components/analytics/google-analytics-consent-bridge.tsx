"use client";

/**
 * Keeps Google Analytics in step with the visitor's analytics consent.
 *
 * Consent granted (already saved at page load, or just now): insert gtag.js once
 * and run `gtag('config', ...)`, which is what starts sending data and enables
 * GA4's automatic page_view. Consent withdrawn: switch GA off at once and delete
 * the cookies it set on this site. Until consent exists, gtag.js is never
 * requested. See tracking-vendors.ts.
 */

import { syncGoogleAnalytics } from "./tracking-vendors";
import { useConsentSync } from "./use-consent-sync";

export function GoogleAnalyticsConsentBridge() {
  useConsentSync(syncGoogleAnalytics);
  return null;
}
