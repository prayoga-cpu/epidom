"use client";

import { useEffect } from "react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";

/**
 * Runs `sync` on mount (a choice saved on an earlier visit) and again whenever
 * the saved choice changes: in this tab ("cookie-consent-updated", or
 * "cookie-consent-cleared" when the record is removed) or in another tab of the
 * same browser (`storage`), so withdrawing in one tab also stops tracking in the
 * others. `sync` must be idempotent.
 */
export function useConsentSync(sync: () => void): void {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // key === null: the whole storage was cleared.
      if (event.key === null || event.key === COOKIE_CONSENT_STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener("cookie-consent-updated", sync);
    window.addEventListener("cookie-consent-cleared", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cookie-consent-updated", sync);
      window.removeEventListener("cookie-consent-cleared", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);
}
