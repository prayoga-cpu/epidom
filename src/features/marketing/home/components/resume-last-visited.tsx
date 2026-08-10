"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LAST_VISITED_KEY = "epidom:lastVisitedUrl";
const REMEMBER_PREF_KEY = "epidom:rememberLastVisited";

/**
 * A returning, signed-in visitor who lands on the marketing homepage gets
 * sent straight back to the last app page this device had open (see
 * LastVisitedTracker) instead of seeing marketing content — unless they've
 * turned this off in Profile settings.
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
      if (localStorage.getItem(REMEMBER_PREF_KEY) !== "true") return;
      const last = localStorage.getItem(LAST_VISITED_KEY);
      if (last && last !== "/") router.replace(last);
    } catch {
      // Ignore blocked storage — worst case, marketing content just shows.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
