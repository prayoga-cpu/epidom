"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";

const LAST_VISITED_KEY = "epidom:lastVisitedUrl";
const REMEMBER_PREF_KEY = "epidom:rememberLastVisited";

/**
 * Mirrors the current app URL (path + query — filters/tabs/open-item state
 * already live there for most of this app, so this captures that "for free")
 * to localStorage on every navigation, and mirrors the user's
 * rememberLastVisited preference alongside it. Both are read purely from
 * localStorage by ResumeLastVisited on the marketing homepage — mirroring
 * the preference here (instead of fetching it again there) means that check
 * needs no API round trip and can fire the moment the page mounts.
 *
 * Device-local by design (localStorage, not synced), same as the sound/tone
 * preferences elsewhere in this app. Renders nothing.
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
    try {
      localStorage.setItem(REMEMBER_PREF_KEY, rememberEnabled ? "true" : "false");
    } catch {
      // Ignore blocked/full storage — this is a best-effort convenience only.
    }
  }, [rememberEnabled]);

  useEffect(() => {
    if (!user) return;
    const search = searchParams.toString();
    const url = pathname + (search ? `?${search}` : "");
    try {
      localStorage.setItem(LAST_VISITED_KEY, url);
    } catch {
      // Ignore — same as above.
    }
  }, [user, pathname, searchParams]);

  return null;
}
