"use client";

/**
 * Keeps the Meta Pixel in step with the visitor's marketing consent.
 *
 * Consent granted (already saved at page load, or just now): insert fbevents.js
 * once, then fbq('init') and the PageView. Consent withdrawn: fbq('consent',
 * 'revoke') at once and delete the cookies the pixel set on this site. Until
 * consent exists, fbevents.js is never requested. See tracking-vendors.ts.
 */

import { useEffect } from "react";
import { sendTrackingEvent, sitePageContext } from "@/lib/tracking-events";
import { syncMetaPixel } from "./tracking-vendors";
import { useConsentSync } from "./use-consent-sync";

type AutoConsentWindow = { __epidomAutoConsent?: boolean };

export function MetaPixelConsentBridge() {
  useConsentSync(syncMetaPixel);

  // CONSENT_BOOT_SCRIPT (src/lib/consent-region.ts) just saved an automatic
  // consent for a country that needs none: count it on /admin/pixel, once.
  useEffect(() => {
    const win = window as unknown as AutoConsentWindow;
    if (!win.__epidomAutoConsent) return;
    win.__epidomAutoConsent = false;
    sendTrackingEvent({ kind: "CONSENT", name: "AUTO", analytics: true, marketing: true, ...sitePageContext() });
  }, []);

  return null;
}
