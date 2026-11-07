"use client";
import { useState } from "react";
import type React from "react";
import { Sidebar } from "@/features/dashboard/shared/sidebar";
import { Topbar } from "@/features/dashboard/shared/topbar";
import { UpgradeGateProvider } from "@/features/billing/upgrade/upgrade-modal";
import { OfflineSyncProvider } from "@/features/dashboard/shared/offline-sync-provider";
import { GlobalSearchDialog } from "@/features/dashboard/shared/global-search-dialog";

/**
 * PageShell Component
 *
 * Provides the layout structure for dashboard pages.
 *
 * Desktop (xl+): a full-height left rail (Sidebar) and the content panel beside
 * it, with no top bar. Below xl (phones, every iPad size): the compact Topbar
 * holds search, the bell and the hamburger that opens the same rail as a drawer.
 * The global search dialog is owned here so both can open it (and ⌘K works
 * wherever the rail or the bar is showing).
 *
 * Note: SessionProvider is now in root layout (app/layout.tsx)
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = () => setSearchOpen(true);

  // 100dvh, not 100vh: this box is the whole app's height with its own scroller
  // inside, and iOS Safari sizes vh as if the toolbar were hidden, which pushed the
  // last rows of a long page under the toolbar.
  return (
    <OfflineSyncProvider>
      <div className="page-transition-container flex h-[calc(100dvh/var(--app-zoom,1))] w-full overflow-hidden">
        {/* Rail column (desktop only): full height, flush to the left edge */}
        <Sidebar mode="desktop" onSearch={openSearch} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone / tablet header: fixed, hidden at xl+ */}
          <Topbar onSearch={openSearch} />

          {/* Main content area: pt-14 clears the fixed header below xl only */}
          <div className="flex min-h-0 flex-1 overflow-hidden pt-14 lg:pt-0">
            {/* The cap is divided by the zoom so it stays a *window*-relative
              1600px rather than a layout-relative one. `zoom` scales a raw px
              cap along with everything else, so an undivided 1600px paints at
              1600 x scale and the container refuses the extra room zooming out
              gives it, measured 95.2% of a 1680px window at 100%, but only
              76.2% at 70%. Dividing pins it to the same share of the window at
              every level. No-op at 100%, where --app-zoom is unset and the
              divisor falls back to 1. */}
            <div className="mx-auto flex w-full max-w-[calc(1600px/var(--app-zoom,1))] pt-2 md:p-6 lg:p-3">
              {/* Content - Fixed height box with scrollable content inside */}
              <main className="bg-card/80 page-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl rounded-b-none border shadow-lg backdrop-blur-md md:rounded-b-xl">
                {/* Scrollable content area. min-h-0 is required here: a flex
                item defaults to min-height:auto (sized to its content),
                which — combined with flex-1 inside an overflow-hidden
                ancestor — lets content grow past the available space
                instead of this div's own overflow-y-auto ever kicking in,
                silently clipping the bottom (e.g. a page with a fixed
                footer button) with no way to scroll to it.

                The padding lives on the INNER div, not this one: a single
                element that's simultaneously `flex flex-col` + `overflow-y-
                auto` + padded clips its own bottom padding once scrolled to
                the end (a longstanding Chromium flexbox/overflow quirk) —
                splitting scroll and padding across two elements avoids it. */}
                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                  {/* min-h-full (not h-full) + padding on every side is right
                  for a page that's naturally taller than the viewport (the
                  common case — Stock, Finance Reports, every hand-tuned
                  min-h-[calc(100vh-Npx)] page): min-h-full is a floor, not a
                  cap, so real content — and this div's own pb-* after it —
                  renders in full and simply overflows into this wrapper's
                  overflow-y-auto ancestor. h-full would look equivalent for
                  a short page, but for a tall one it anchors pb-* to *this
                  div's* fixed bottom edge instead of to wherever the content
                  actually ends, which (with default overflow: visible) sits
                  past that edge — so the padding ends up hidden behind the
                  overflow instead of trailing it. */}
                  <div className="flex min-h-full flex-col p-2 md:p-6">
                    <UpgradeGateProvider>{children}</UpgradeGateProvider>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </OfflineSyncProvider>
  );
}
