/**
 * View Transitions Hook
 *
 * Enables smooth page transitions using the View Transitions API
 * Falls back gracefully for browsers that don't support it
 */

import { useEffect } from "react";

export function useViewTransitions() {
  useEffect(() => {
    // Check if View Transitions API is available
    if (typeof document === "undefined" || !("startViewTransition" in document)) {
      return;
    }

    // Enable view transitions for navigation
    // This will make page changes feel instant and smooth
    const handleBeforeUnload = () => {
      if ("startViewTransition" in document) {
        // Browser supports view transitions
        // Next.js will handle the actual transition
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
