"use client";

import { Component, Suspense, lazy, type ReactNode } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { HelpSheetProps } from "./help-sheet";

// The sheet carries every guide in three languages, so it is its own chunk:
// fetched on the first "Help & what's new" or "Learn more" tap (or ahead of it
// by preloadHelpSheet), never with every POS page. Plain React.lazy — what
// next/dynamic is in the app router — so a failed load throws to the boundary
// below the same way in tests as in the app. Only ever mounted after a tap, so
// it never renders on the server.
const HelpSheet = lazy(() => import("./help-sheet").then((m) => ({ default: m.HelpSheet })));

interface HelpSheetBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/**
 * Keeps a failed load of the sheet's chunk (offline, before it was ever
 * fetched) inside the sheet. Without it the lazy import's rejection reaches
 * the POS shell's ErrorBoundary or the route's error.tsx, which swap the whole
 * till for an error screen. Deliberately never calls reloadForStaleChunk:
 * Help is not worth reloading the till for.
 */
class HelpSheetBoundary extends Component<HelpSheetBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The POS Mode Help sheet, loaded on demand. Mount it only once it has been
 * opened (`{open && <LazyHelpSheet … />}`): the chunk is fetched then, and a
 * load that fails closes it again with a toast (the next open starts clean).
 */
export function LazyHelpSheet(props: HelpSheetProps) {
  const { t } = useI18n();
  const { onOpenChange } = props;

  return (
    <HelpSheetBoundary
      onError={() => {
        onOpenChange(false);
        toast.error(t("helpCenter.loadFailed"));
      }}
    >
      <Suspense fallback={null}>
        <HelpSheet {...props} />
      </Suspense>
    </HelpSheetBoundary>
  );
}

let preloadStarted = false;

/**
 * Fetches the sheet's chunk ahead of the first tap, so Help still opens after
 * the connection drops mid-shift: the module stays loaded for this page, and
 * the service worker keeps the chunk for the next load. Runs at an idle
 * moment, and only while online: the chunk runtime remembers a failed load for
 * the rest of the page's life, so a try made offline would break Help until a
 * reload. Offline, it waits for the connection to come back.
 *
 * Returns a cleanup, for a useEffect.
 */
export function preloadHelpSheet(): () => void {
  if (typeof window === "undefined" || preloadStarted) return () => {};

  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const load = () => {
    idleHandle = null;
    timeoutHandle = null;
    if (cancelled || preloadStarted) return;
    // Went offline while waiting for the idle moment: wait for the connection.
    if (!navigator.onLine) {
      schedule();
      return;
    }
    preloadStarted = true;
    void import("./help-sheet").catch(() => {
      // Nothing to show here: a real open reports it (LazyHelpSheet's toast).
    });
  };

  const onOnline = () => schedule();

  function schedule() {
    if (cancelled || preloadStarted) return;
    if (!navigator.onLine) {
      window.addEventListener("online", onOnline, { once: true });
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(load, { timeout: 5000 });
    } else {
      timeoutHandle = setTimeout(load, 2000);
    }
  }

  schedule();

  return () => {
    cancelled = true;
    window.removeEventListener("online", onOnline);
    if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  };
}
