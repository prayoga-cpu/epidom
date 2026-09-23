import { useSyncExternalStore } from "react";

/**
 * Whether the viewport is at least `minPx` wide, as external state. The server
 * snapshot is false so SSR and the first client render agree; the real value
 * lands right after mount. Uses the same media query Tailwind's `min-width`
 * breakpoints do (`lg` = 1024), so a JS switch made with this can never disagree
 * with a sibling's `lg:` classes.
 */
export function useMinWidth(minPx: number): boolean {
  const query = `(min-width: ${minPx}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Tailwind's `lg` breakpoint. */
export const LG_MIN_WIDTH_PX = 1024;
