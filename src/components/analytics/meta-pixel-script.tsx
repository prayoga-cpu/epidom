// Meta Pixel IDs aren't secret — they're visible in every page's source and
// network requests. Hardcoded as a fallback so this works even if the env var
// isn't configured in the hosting provider's dashboard (.env is gitignored and
// never deploys; NEXT_PUBLIC_META_PIXEL_ID must be set there to override).
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821676715464709";

/**
 * Meta (Facebook) Pixel base code.
 *
 * Uses a plain native <script> tag (dangerouslySetInnerHTML), not
 * next/script — next/script's content (even with strategy="beforeInteractive")
 * is streamed through Next's RSC hydration payload and only turned into a real
 * <script> element by client-side JS, so it never appears as literal markup in
 * the server-rendered HTML. Meta's install check and crawlers that read raw
 * HTML need an actual <script> tag physically inside <head>, which only a
 * native tag guarantees. The content here is a static, developer-authored
 * literal (only the pixel ID is interpolated, not user input), so
 * dangerouslySetInnerHTML carries no injection risk.
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
      <script
        id="meta-pixel-base"
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
