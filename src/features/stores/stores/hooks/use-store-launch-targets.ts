"use client";

import { useEffect, useState } from "react";
import {
  LAST_VISITED_BACK_OFFICE_COOKIE,
  LAST_VISITED_POS_COOKIE,
  isBackOfficeAppPath,
  isPosAppPath,
} from "@/lib/last-visited";

/**
 * Where Back Office opens when there is nothing to resume: the user's default
 * landing section, except that "pos" is not a Back Office page, so it falls
 * back to the dashboard.
 */
export function defaultBackOfficeHref(storeId: string, defaultLanding: string): string {
  return `/store/${storeId}/${defaultLanding === "pos" ? "dashboard" : defaultLanding}`;
}

interface Resumed {
  storeId: string;
  pos: string | null;
  backOffice: string | null;
}

/**
 * The two places the /stores chooser can open a store: its POS and its Back
 * Office. Each resumes the last page visited in THIS store on this device
 * (the same keys PosModeOverflowMenu's Back Office shortcut reads), and a path
 * saved for another store, or for the other half of the app, is ignored.
 */
export function useStoreLaunchTargets(
  storeId: string,
  defaultLanding: string
): { posHref: string; backOfficeHref: string } {
  const [resumed, setResumed] = useState<Resumed | null>(null);

  useEffect(() => {
    const prefix = `/store/${storeId}/`;
    const read = (key: string, accept: (path: string) => boolean): string | null => {
      try {
        const last = localStorage.getItem(key);
        return last && last.startsWith(prefix) && accept(last) ? last : null;
      } catch {
        // Blocked storage: fall back to the defaults.
        return null;
      }
    };
    setResumed({
      storeId,
      pos: read(LAST_VISITED_POS_COOKIE, isPosAppPath),
      backOffice: read(LAST_VISITED_BACK_OFFICE_COOKIE, isBackOfficeAppPath),
    });
  }, [storeId]);

  // Never hand one store's resume path to another store's card.
  const current = resumed?.storeId === storeId ? resumed : null;
  return {
    posHref: current?.pos ?? `/store/${storeId}/pos`,
    backOfficeHref: current?.backOffice ?? defaultBackOfficeHref(storeId, defaultLanding),
  };
}
