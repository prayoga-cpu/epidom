"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth-client";
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
 * localStorage alone isn't enough to decide to redirect: both keys are only
 * ever WRITTEN while genuinely signed in, but they're only cleared on an
 * explicit logout (see nav-user.tsx) — a session that simply expires leaves
 * them behind. Trusting them on their own would bounce a signed-out visitor
 * straight into a protected page that immediately redirects them to /login,
 * so the marketing homepage they asked for is never shown — the exact bug
 * this mirrors in src/proxy.ts. useUser() re-verifies against the actual
 * session (a real request, since the session cookie is httpOnly and can't be
 * read from here) before acting on the localStorage candidate.
 */
export function ResumeLastVisited(): null {
  const router = useRouter();
  const { user, loading } = useUser();
  const [candidate, setCandidate] = useState<string | null>(null);

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
        setCandidate(last);
      }
    } catch {
      // Ignore blocked storage — worst case, marketing content just shows.
    }
  }, []);

  useEffect(() => {
    // Logged in first, resume target second: without a verified session,
    // there is nothing to resume onto, so leave the marketing page showing.
    if (!candidate || loading || !user) return;
    router.replace(candidate);
  }, [candidate, loading, user, router]);

  return null;
}
