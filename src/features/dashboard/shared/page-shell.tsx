"use client";
import type React from "react";
import { Sidebar } from "@/features/dashboard/shared/sidebar";
import { Topbar } from "@/features/dashboard/shared/topbar";
import { UpgradeGateProvider } from "@/features/billing/upgrade/upgrade-modal";

/**
 * PageShell Component
 *
 * Provides the layout structure for dashboard pages.
 * Includes Topbar, Sidebar, and main content area.
 *
 * Note: SessionProvider is now in root layout (app/layout.tsx)
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition-container flex h-screen w-full flex-col overflow-hidden">
      {/* Topbar - Fixed at top */}
      <Topbar />

      {/* Main content area - Fixed height container with padding for topbar */}
      <div className="flex min-h-0 flex-1 overflow-hidden pt-14">
        <div className="mx-auto flex w-full max-w-[1600px] gap-4 pt-2 md:gap-6 md:p-6 lg:px-8">
          {/* Sidebar column (desktop only) */}
          <Sidebar mode="desktop" />

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
              {/* min-h-full (not h-full): gives a page that wants to fill the
                  viewport and manage its own internal scroll regions (e.g.
                  PosShell — a fixed-height app with its own item-grid/cart
                  overflow-y-auto children) a definite height to size its
                  flex-1 against, without capping/clipping a normal page
                  whose content is naturally taller than the viewport — that
                  content still grows past min-h-full and scrolls via this
                  wrapper's own overflow-y-auto ancestor exactly as before. */}
              <div className="flex min-h-full flex-col p-2 md:p-6">
                <UpgradeGateProvider>{children}</UpgradeGateProvider>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
