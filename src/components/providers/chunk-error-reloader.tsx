"use client";

import { useEffect } from "react";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/utils/stale-chunk-reload";

/**
 * Catches stale-chunk failures that happen outside React's render tree (a
 * `<script>`/`<link>` the runtime injected directly, rather than a
 * React.lazy() import ErrorBoundary would catch) and recovers with a reload.
 * See stale-chunk-reload.ts for why this is safe to do automatically.
 */
export function ChunkErrorReloader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Resource load failures (script/link) don't bubble — only the capture
    // phase on window sees them.
    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
        const src = target instanceof HTMLScriptElement ? target.src : target.href;
        if (src.includes("/_next/static/")) {
          reloadForStaleChunk();
          return;
        }
      }

      const message = (event as ErrorEvent).message;
      if (isStaleChunkError(message)) {
        reloadForStaleChunk();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (isStaleChunkError(message) || (reason instanceof Error && reason.name === "ChunkLoadError")) {
        reloadForStaleChunk();
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
