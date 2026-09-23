"use client";

/**
 * Keeps the Meta Pixel in step with the visitor's marketing consent.
 *
 * Consent granted (already saved at page load, or just now): insert fbevents.js
 * once, then fbq('init') and the PageView. Consent withdrawn: fbq('consent',
 * 'revoke') at once and delete the cookies the pixel set on this site. Until
 * consent exists, fbevents.js is never requested. See tracking-vendors.ts.
 */

import { syncMetaPixel } from "./tracking-vendors";
import { useConsentSync } from "./use-consent-sync";

export function MetaPixelConsentBridge() {
  useConsentSync(syncMetaPixel);
  return null;
}
