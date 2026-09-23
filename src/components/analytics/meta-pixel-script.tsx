import Script from "next/script";

/**
 * The inline Meta Pixel stub. It defines `window.fbq` so calls made before the
 * real pixel exists are queued instead of throwing, and it makes NO network
 * request: fbevents.js is not inserted here. MetaPixelConsentBridge loads it (and
 * runs fbq('init') / fbq('track', 'PageView')) only once the visitor has granted
 * marketing consent, on page load if the choice is already saved, or the moment
 * it is granted.
 *
 * This is Meta's standard base code with its script-insertion step removed.
 * Exported so a test can run it against jsdom and prove it stays request-free.
 */
export const META_PIXEL_STUB = `!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);`;

/**
 * Uses next/script with strategy="beforeInteractive" rather than a plain native
 * <script> tag: React 19 warns/errors on <script> rendered directly in a
 * component tree (it's never executed by React on the client). Next.js injects
 * beforeInteractive scripts into <head> of the server-rendered HTML, so the stub
 * exists before hydration and before any bridge effect runs. The content is a
 * static, developer-authored literal, so dangerouslySetInnerHTML carries no
 * injection risk.
 *
 * There is deliberately no <noscript><img> fallback: Meta's tracking image
 * cannot honour consent, so without JavaScript nothing is sent to Meta at all.
 */
export function MetaPixelScript() {
  return (
    <Script
      id="meta-pixel-base"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: META_PIXEL_STUB }}
    />
  );
}
