"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";

// 400 days — the Chrome-enforced ceiling on Set-Cookie max-age, used here as
// "as long as the platform allows" rather than a deliberately chosen TTL.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function setCookie(name: string, value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Mirrors the current app URL (path + query — filters/tabs/open-item state
 * already live there for most of this app, so this captures that "for free")
 * and the user's rememberLastVisited preference, to both localStorage and a
 * first-party cookie. The cookie is what actually drives the resume-on-
 * sign-in redirect now (see src/middleware.ts, which reads it Edge-side
 * before any marketing page renders — a client-side check on the marketing
 * homepage would show a flash of marketing content first). localStorage is
 * kept as a same-behavior fallback for the rare case cookies are blocked
 * while localStorage isn't (see ResumeLastVisited).
 *
 * Device-local by design (not synced to the account), same as the
 * sound/tone preferences elsewhere in this app. Renders nothing.
 */
export function LastVisitedTracker(): null {
  const { user } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: rememberEnabled } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () =>
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => (d?.success && d?.data ? d.data : d)),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    select: (d: any): boolean => d?.rememberLastVisited ?? true,
  });

  useEffect(() => {
    if (rememberEnabled === undefined) return;
    const value = rememberEnabled ? "true" : "false";
    try {
      localStorage.setItem(REMEMBER_PREF_COOKIE, value);
    } catch {
      // Ignore blocked/full storage — this is a best-effort convenience only.
    }
    try {
      setCookie(REMEMBER_PREF_COOKIE, value);
    } catch {
      // Ignore — same as above.
    }
  }, [rememberEnabled]);

  useEffect(() => {
    if (!user) return;
    // Print routes (attendance/schedule/management/finance/pos-orders print
    // reports) auto-open the browser's print dialog and are meant to be
    // closed right after, not resumed — saving one here means a signed-in
    // visit to the marketing homepage can redirect straight back into a
    // print dialog with no normal page behind it to navigate back to.
    if (pathname.endsWith("/print")) return;
    const search = searchParams.toString();
    const url = pathname + (search ? `?${search}` : "");
    try {
      localStorage.setItem(LAST_VISITED_COOKIE, url);
    } catch {
      // Ignore — same as above.
    }
    try {
      setCookie(LAST_VISITED_COOKIE, url);
    } catch {
      // Ignore — same as above.
    }
  }, [user, pathname, searchParams]);

  return null;
}
