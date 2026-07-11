"use client";

/**
 * Fires the Meta Pixel PageView the moment a visitor accepts marketing
 * cookies mid-session, without needing a reload. MetaPixelScript (the
 * <head> base code) only checks consent once, synchronously, at initial
 * page load — this listens for the cookie-consent bar's
 * "cookie-consent-updated" event to catch consent granted *after* that.
 */

import { useEffect, useRef } from "react";
import { hasMarketingConsent } from "@/lib/cookie-consent";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821676715464709";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixelConsentBridge() {
  const firedRef = useRef(false);

  useEffect(() => {
    const maybeFire = () => {
      if (firedRef.current) return;
      if (!hasMarketingConsent()) return;
      if (typeof window.fbq !== "function") return;

      window.fbq("init", META_PIXEL_ID);
      window.fbq("track", "PageView");
      firedRef.current = true;
    };

    window.addEventListener("cookie-consent-updated", maybeFire);

    return () => {
      window.removeEventListener("cookie-consent-updated", maybeFire);
    };
  }, []);

  return null;
}
