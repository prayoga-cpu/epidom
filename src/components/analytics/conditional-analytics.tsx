"use client";

/**
 * Conditional Analytics Component
 *
 * Only loads analytics if user has given consent.
 * Reactively loads/unloads analytics based on consent changes without page reload:
 * accepting mounts it, withdrawing (Manage cookies in the footer) unmounts it.
 */

import { useCallback, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";
import { useConsentSync } from "./use-consent-sync";

export function ConditionalAnalytics() {
  const [shouldLoad, setShouldLoad] = useState(false);

  // On mount, and on every change of the saved choice (this tab or another one).
  useConsentSync(useCallback(() => setShouldLoad(hasAnalyticsConsent()), []));

  // Only render Analytics component if user has consented
  // Vercel Analytics is lightweight and can be mounted/unmounted dynamically
  if (!shouldLoad) return null;

  return <Analytics />;
}
