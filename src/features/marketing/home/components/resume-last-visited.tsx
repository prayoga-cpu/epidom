"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";

/**
 * Fallback for the resume-on-sign-in redirect. The primary path is
 * src/middleware.ts, which reads the same state from a cookie and redirects
 * Edge-side before this page's HTML is even sent — this component only
 * fires when that didn't happen, e.g. a browser that accepts localStorage
 * writes but blocks first-party cookies. In the normal case, middleware
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
      if (last && last !== "/") router.replace(last);
    } catch {
      // Ignore blocked storage — worst case, marketing content just shows.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
