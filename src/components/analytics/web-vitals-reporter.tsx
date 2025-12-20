"use client";

/**
 * Web Vitals Reporter Component
 *
 * Initializes Web Vitals tracking when mounted.
 * Place this component near the root of your app.
 */

import { useEffect } from "react";

export function WebVitalsReporter(): null {
  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    // Dynamic import to avoid SSR issues
    import("@/lib/web-vitals").then(({ initWebVitals }) => {
      initWebVitals();
    });
  }, []);

  // This component renders nothing
  return null;
}
