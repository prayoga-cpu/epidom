"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LAST_VISITED_COOKIE,
  REMEMBER_PREF_COOKIE,
  isResumableAppPath,
  isSafeRedirectTarget,
} from "@/lib/last-visited";

/**
 * Fallback for the resume-on-sign-in redirect. The primary path is
 * src/proxy.ts, which reads the same state from a cookie and redirects
 * Edge-side before this page's HTML is even sent — this component only
 * fires when that didn't happen, e.g. a browser that accepts localStorage
 * writes but blocks first-party cookies. In the normal case, the proxy
 * already redirected and this never mounts.
 *
 * Purely localStorage-driven, no API call and no auth check needed here:
 * both keys are only ever written by LastVisitedTracker while genuinely
 * signed in, so an anonymous visitor (or one who's logged out — see
 * nav-user.tsx's logout handler, which clears both keys) simply has nothing
 * to redirect to and this silently no-ops.
 */
export function ResumeLastVisited(): null {
  const router = useRouter();

  useEffect(() => {
    try {
      if (localStorage.getItem(REMEMBER_PREF_COOKIE) !== "true") return;
      const last = localStorage.getItem(LAST_VISITED_COOKIE);
      // Both checks, exactly as src/proxy.ts applies them to the cookie:
      // localStorage is fully writable by any script that gets a foothold on
      // this origin, so "same-origin path" (isSafeRedirectTarget) and "route
      // that still exists" (isResumableAppPath) both have to hold before we
      // hand the value to the router. Without them this was a router.replace
      // of whatever string happened to be in storage — an open redirect on
      // one hand, and on the other the single most common way a returning
      // user lands on a 404 the moment they open the app.
      if (last && isSafeRedirectTarget(last) && isResumableAppPath(last)) {
        router.replace(last);
      }
    } catch {
      // Ignore blocked storage — worst case, marketing content just shows.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
