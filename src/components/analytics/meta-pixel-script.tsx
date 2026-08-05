import Script from "next/script";

// Meta Pixel IDs aren't secret — they're visible in every page's source and
// network requests. Hardcoded as a fallback so this works even if the env var
// isn't configured in the hosting provider's dashboard (.env is gitignored and
// never deploys; NEXT_PUBLIC_META_PIXEL_ID must be set there to override).
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821676715464709";

/**
 * Meta (Facebook) Pixel base code.
 *
 * Uses next/script with strategy="beforeInteractive" rather than a plain
 * native <script> tag: React 19 warns/errors on <script> rendered directly
 * in a component tree (it's never executed by React on the client). Next.js
 * injects beforeInteractive scripts into <head> of the actual server-rendered
 * HTML — before hydration — so Meta's install check and crawlers reading raw
 * HTML still see a literal <script> tag; only later strategies
 * (afterInteractive/lazyOnload) defer to a client-side-only insert. The
 * content here is a static, developer-authored literal (only the pixel ID is
 * interpolated, not user input), so dangerouslySetInnerHTML carries no
 * injection risk.
 *
 * Consent is still respected: the inline script only reads the same
 * localStorage consent record the cookie-consent bar writes to, and only
 * calls fbq('init'/'track') if marketing consent was already granted on a
 * previous visit — nothing is sent to Meta before that. MetaPixelConsentBridge
 * (a separate client component) fires it the first time a visitor accepts
 * consent mid-session, without needing a page reload.
 */
export function MetaPixelScript() {
  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            (function () {
              try {
                var prefs = JSON.parse(localStorage.getItem('cookie-consent-preferences') || 'null');
                if (prefs && prefs.marketing) {
                  fbq('init', '${META_PIXEL_ID}');
                  fbq('track', 'PageView');
                }
              } catch (e) {}
            })();
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
