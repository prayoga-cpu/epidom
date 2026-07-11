/**
 * Analytics Utility
 *
 * Helper functions for tracking events with cookie consent checking.
 * Only tracks if user has given consent for analytics or marketing cookies.
 */

import { hasAnalyticsConsent, hasMarketingConsent } from "./cookie-consent";

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "set",
      targetId: string,
      config?: Record<string, any>
    ) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Track event with consent checking
 * Only tracks if user has given consent for analytics or marketing
 */
export function trackEvent(
  eventName: string,
  params?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
): void {
  // Check if user has consented to analytics or marketing
  if (!hasAnalyticsConsent() && !hasMarketingConsent()) {
    return;
  }

  // Check if gtag is available (Google Analytics)
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }

  // You can add other analytics providers here (e.g., Vercel Analytics events)
  // Vercel Analytics is handled automatically by ConditionalAnalytics component
}

/**
 * Track conversion event (marketing category)
 */
export function trackConversion(
  eventName: string,
  params?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
): void {
  // Conversions are marketing events, so check marketing consent
  if (!hasMarketingConsent()) {
    return;
  }

  trackEvent(eventName, {
    ...params,
    event_category: params?.event_category || "conversion",
  });
}

/**
 * Track a Meta (Facebook) Pixel event — marketing category, so it only fires
 * once the visitor has granted marketing-cookie consent (same gate the base
 * pixel code in meta-pixel-script.tsx uses). Use Meta's standard event names
 * (e.g. "CompleteRegistration", "Purchase", "Lead") when one fits, so Meta
 * can optimize campaigns against it natively instead of a custom event.
 */
export function trackMetaPixelEvent(eventName: string, params?: Record<string, any>): void {
  if (!hasMarketingConsent()) {
    return;
  }

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}

/**
 * Track page view (analytics category)
 */
export function trackPageView(url: string, title?: string): void {
  if (!hasAnalyticsConsent()) {
    return;
  }

  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("config", "GA_MEASUREMENT_ID", {
      page_path: url,
      page_title: title,
    });
  }
}
