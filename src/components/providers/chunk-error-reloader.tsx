"use client";

import { useEffect } from "react";
import {
  armReloadOnReconnect,
  isOffline,
  isStaleChunkError,
  reloadForStaleChunk,
} from "@/lib/utils/stale-chunk-reload";

/**
 * Catches stale-chunk failures that happen outside React's render tree (a
 * `<script>`/`<link>` the runtime injected directly, rather than a
 * React.lazy() import ErrorBoundary would catch) and recovers with a reload.
 * See stale-chunk-reload.ts for why this is safe to do automatically.
 */
export function ChunkErrorReloader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    /**
     * Single recovery path for both listeners. A missing chunk and a dead
     * network are indistinguishable from here, so consult `navigator.onLine`
     * before doing anything drastic: reloading while offline throws away the
     * user's working screen, gets the service worker's offline page back, and
     * then the sessionStorage cooldown strands them there. Deferring to the
     * `online` event costs nothing — if the deploy really did rotate, the
     * reload that fires on reconnect still fixes it.
     *
     * Note this is deliberately reached only once a failure has been positively
     * identified as chunk-shaped; arming the deferred reload on every offline
     * error would bounce the tab on reconnect for unrelated failed requests.
     */
    const recover = () => {
      if (isOffline()) {
        armReloadOnReconnect();
        return;
      }
      reloadForStaleChunk();
    };

    // Resource load failures (script/link) don't bubble — only the capture
    // phase on window sees them.
    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
        const src = target instanceof HTMLScriptElement ? target.src : target.href;
        if (src.includes("/_next/static/")) {
          recover();
          return;
        }
      }

      const message = (event as ErrorEvent).message;
      if (isStaleChunkError(message)) {
        recover();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (isStaleChunkError(message) || (reason instanceof Error && reason.name === "ChunkLoadError")) {
        recover();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
