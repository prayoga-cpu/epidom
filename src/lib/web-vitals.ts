/**
 * Web Vitals Tracking
 *
 * Tracks Core Web Vitals metrics:
 * - LCP (Largest Contentful Paint) - loading performance
 * - INP (Interaction to Next Paint) - interactivity
 * - CLS (Cumulative Layout Shift) - visual stability
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 *
 * Sends metrics to analytics endpoint for monitoring.
 */

import type { Metric } from "web-vitals";

// Thresholds based on Google's recommendations
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

type Rating = "good" | "needs-improvement" | "poor";

/**
 * Get rating for a metric value
 */
function getRating(name: string, value: number): Rating {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Report Web Vitals metric
 * Called automatically by next/web-vitals
 */
export function reportWebVitals(metric: Metric): void {
  const { name, value, id, rating } = metric;

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    const emoji =
      rating === "good"
        ? "[GOOD]"
        : rating === "needs-improvement"
          ? "[NEEDS IMPROVEMENT]"
          : "[POOR]";
    console.log(`Web Vitals ${emoji} ${name}: ${Math.round(value)}ms`);
  }

  // Send to analytics endpoint in production
  if (process.env.NODE_ENV === "production") {
    const body = JSON.stringify({
      name,
      value: Math.round(name === "CLS" ? value * 1000 : value),
      rating: rating || getRating(name, value),
      id,
      page: typeof window !== "undefined" ? window.location.pathname : "",
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliable delivery
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/web-vitals", body);
    } else {
      // Fallback to fetch
      fetch("/api/analytics/web-vitals", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        // Silently fail - analytics should not break the app
      });
    }
  }
}

/**
 * Initialize Web Vitals reporting
 * Call this in your app's entry point
 */
export async function initWebVitals(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import("web-vitals");

    onCLS(reportWebVitals);
    onINP(reportWebVitals);
    onLCP(reportWebVitals);
    onFCP(reportWebVitals);
    onTTFB(reportWebVitals);
  } catch (error) {
    // web-vitals not available, skip
    console.warn("Web Vitals not available:", error);
  }
}
