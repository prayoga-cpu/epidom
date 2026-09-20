import Script from "next/script";

/**
 * The inline Google Analytics stub. It defines `window.dataLayer` and
 * `window.gtag` so calls made before gtag.js exists are queued instead of
 * throwing, and it makes NO network request: gtag.js is not inserted here.
 * GoogleAnalyticsConsentBridge loads it (and runs gtag('config'), which is what
 * starts sending data) only once the visitor has granted analytics consent, on
 * page load if the choice is already saved, or the moment it is granted.
 *
 * gtag.js needs `arguments` objects on the dataLayer, hence the classic
 * function. Exported so a test can run it against jsdom and prove it stays
 * request-free.
 */
export const GOOGLE_ANALYTICS_STUB = `window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
}`;

/**
 * Uses the standard `afterInteractive` strategy. The bridge also defines the same
 * stub if it happens to run first, so the order of the two does not matter.
 */
export function GoogleAnalyticsScript() {
  return (
    <Script id="google-analytics-base" strategy="afterInteractive">
      {GOOGLE_ANALYTICS_STUB}
    </Script>
  );
}
