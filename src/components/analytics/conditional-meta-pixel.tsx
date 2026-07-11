"use client";

/**
 * Conditional Meta Pixel Component
 *
 * Only loads the Meta (Facebook) Pixel if the user has given marketing-cookie
 * consent. Reactively loads/unloads based on consent changes without a page
 * reload — mirrors ConditionalAnalytics.
 */

import { useEffect, useState } from "react";
import Script from "next/script";
import { hasMarketingConsent } from "@/lib/cookie-consent";

// Meta Pixel IDs aren't secret — they're visible in every page's source/network
// requests. Hardcoded as a fallback so this works even if the env var isn't
// configured in the hosting provider's dashboard (.env is gitignored and never
// deployed; NEXT_PUBLIC_META_PIXEL_ID must be set there separately to override).
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821676715464709";

export function ConditionalMetaPixel() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      setShouldLoad(hasMarketingConsent());
    };

    checkConsent();

    window.addEventListener("cookie-consent-updated", checkConsent);

    return () => {
      window.removeEventListener("cookie-consent-updated", checkConsent);
    };
  }, []);

  if (!shouldLoad || !META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
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
