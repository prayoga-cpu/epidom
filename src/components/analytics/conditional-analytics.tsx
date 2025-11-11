"use client";

/**
 * Conditional Analytics Component
 *
 * Only loads analytics if user has given consent.
 * Reactively loads/unloads analytics based on consent changes without page reload.
 * Best practice: No page reload needed - analytics loads immediately after consent.
 */

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";

export function ConditionalAnalytics() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Check consent on mount
    const checkConsent = () => {
      setShouldLoad(hasAnalyticsConsent());
    };

    // Initial check
    checkConsent();

    // Listen for consent changes (reactive - no reload needed)
    const handleConsentUpdate = () => {
      checkConsent();
    };

    window.addEventListener("cookie-consent-updated", handleConsentUpdate);

    return () => {
      window.removeEventListener("cookie-consent-updated", handleConsentUpdate);
    };
  }, []);

  // Only render Analytics component if user has consented
  // Vercel Analytics is lightweight and can be mounted/unmounted dynamically
  if (!shouldLoad) return null;

  return <Analytics />;
}

