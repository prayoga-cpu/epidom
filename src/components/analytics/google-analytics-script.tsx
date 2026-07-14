import Script from "next/script";

// Not a secret — GA measurement IDs are visible in every page's network
// requests. Hardcoded as a fallback so this works even if the env var isn't
// configured in the hosting provider's dashboard (.env is gitignored and
// never deploys; NEXT_PUBLIC_GA_MEASUREMENT_ID must be set there to override).
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-S7DYSLM84X";

/**
 * Google Analytics 4 (gtag.js) base code.
 *
 * Uses next/script with the standard `afterInteractive` strategy — unlike the
 * Meta Pixel, Google's own debugging tools (Tag Assistant, GA4 DebugView)
 * inspect the live page/network requests rather than raw server HTML, so
 * there's no need to force literal markup into <head>.
 *
 * Consent is respected the same way as the Meta Pixel: the loader always
 * runs, but the actual `gtag('config', ...)` call — which is what starts
 * sending data and enables GA4's automatic page_view tracking — only fires if
 * the visitor already granted analytics-cookie consent (checked synchronously
 * against the same localStorage record the cookie bar writes to).
 * GoogleAnalyticsConsentBridge (a separate client component) fires it the
 * first time a visitor accepts consent mid-session, without a reload.
 */
export function GoogleAnalyticsScript() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-base" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          try {
            var prefs = JSON.parse(localStorage.getItem('cookie-consent-preferences') || 'null');
            if (prefs && prefs.analytics) {
              gtag('config', '${GA_MEASUREMENT_ID}');
            }
          } catch (e) {}
        `}
      </Script>
    </>
  );
}
