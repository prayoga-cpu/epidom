import { useEffect, useState } from "react";
import { localDateKey } from "../lib/date-range-presets";

/**
 * The user's local calendar date (YYYY-MM-DD), kept current. It ticks over at
 * local midnight, and is re-checked when the tab is shown or focused again — a
 * tablet that slept overnight never fires a timer that was due while it slept.
 *
 * Anything derived from "today" (the order queue's default date filter) should
 * list this as a dependency, so a till left open past midnight moves to the new
 * day by itself instead of showing yesterday under a "Today" label. Don't render
 * the key itself: the server and the browser can disagree on the date.
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => localDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // A no-op when the day hasn't changed (React bails out of an equal state).
    const sync = () => setKey(localDateKey());

    const scheduleNextMidnight = () => {
      const now = new Date();
      // Half a second past midnight, so the timer can't fire a hair early and
      // find it is still "yesterday".
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 500);
      timer = setTimeout(() => {
        sync();
        scheduleNextMidnight();
      }, next.getTime() - now.getTime());
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    scheduleNextMidnight();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return key;
}
