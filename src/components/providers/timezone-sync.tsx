"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

// v2: bumped so every browser re-syncs once after `timezoneUpdatedAt` was
// added — otherwise a browser that already matched its stored timezone
// under the old key would never call the route again, leaving that column
// null forever even though the value itself was already correct.
const TZ_STORAGE_KEY = "epidom:tz:v2";

/**
 * TimezoneSync
 *
 * Best-effort, non-blocking sync of the signed-in user's browser timezone to
 * the database. The admin panel derives the "Region" column from the user's
 * stored IANA timezone, so persisting the real device zone keeps it accurate
 * without any manual setup.
 *
 * - Self-gates on session: no-ops until the user is authenticated, so it is
 *   harmless on the login/register pages that share the (app) layout.
 * - Guards with localStorage to avoid redundant network calls on every load.
 * - Swallows all errors silently — this must never disrupt the UI.
 *
 * Renders nothing.
 */
export function TimezoneSync(): null {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    // Already synced this zone from this device — nothing to do.
    if (window.localStorage.getItem(TZ_STORAGE_KEY) === tz) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/user/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: tz }),
        });
        if (!cancelled && res.ok) {
          window.localStorage.setItem(TZ_STORAGE_KEY, tz);
        }
      } catch {
        // Best-effort: ignore failures (offline, rate limit, etc.).
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return null;
}
