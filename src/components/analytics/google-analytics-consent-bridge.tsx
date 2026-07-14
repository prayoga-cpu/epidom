"use client";

/**
 * Fires `gtag('config', ...)` the moment a visitor accepts analytics cookies
 * mid-session, without needing a reload. GoogleAnalyticsScript (the base
 * gtag.js loader) only checks consent once, synchronously, at initial page
 * load — this listens for the cookie-consent bar's "cookie-consent-updated"
 * event to catch consent granted *after* that, so trackEvent()/trackConversion()
 * calls made later in the same session actually reach GA.
 */

import { useEffect, useRef } from "react";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-S7DYSLM84X";

export function GoogleAnalyticsConsentBridge() {
  const firedRef = useRef(false);

  useEffect(() => {
    const maybeFire = () => {
      if (firedRef.current) return;
      if (!hasAnalyticsConsent()) return;
      if (typeof window.gtag !== "function") return;

      window.gtag("config", GA_MEASUREMENT_ID);
      firedRef.current = true;
    };

    window.addEventListener("cookie-consent-updated", maybeFire);

    return () => {
      window.removeEventListener("cookie-consent-updated", maybeFire);
    };
  }, []);

  return null;
}
