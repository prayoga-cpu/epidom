/**
 * Analytics Utility
 *
 * Helper functions for tracking events with cookie consent checking.
 * Events are DROPPED when the matching consent is missing, never queued for a
 * later flush: the stubs behind window.gtag / window.fbq queue their calls until
 * the vendor script loads, so a call made without consent would otherwise be
 * sent as soon as the visitor accepted later. Google Analytics events need
 * analytics consent; Meta Pixel events need marketing consent.
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
 * Track a Google Analytics event.
 * Dropped unless the visitor has granted analytics consent: gtag.js is only
 * loaded on that consent, and until it loads the stub queues calls and would
 * flush them later.
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
  if (!hasAnalyticsConsent()) {
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
 * Track conversion event (marketing category). It is a Google Analytics event
 * too, so it needs marketing AND analytics consent: without the first it is
 * dropped here, without the second trackEvent() drops it.
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
