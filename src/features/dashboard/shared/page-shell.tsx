"use client";
import type React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/features/dashboard/shared/sidebar";
import { Topbar } from "@/features/dashboard/shared/topbar";
import { UpgradeGateProvider } from "@/features/billing/upgrade/upgrade-modal";
import { cn } from "@/lib/utils";

// Matches only the POS cashier screen itself (/store/{id}/pos), not its
// siblings (/pos/orders, /pos/kds) — the one page in the dashboard that
// wants to fill the viewport exactly, edge to edge, with no breathing room
// below it, instead of the padded/scrollable treatment every other page gets.
const POS_CASHIER_PATH = /^\/store\/[^/]+\/pos\/?$/;

/**
 * PageShell Component
 *
 * Provides the layout structure for dashboard pages.
 * Includes Topbar, Sidebar, and main content area.
 *
 * Note: SessionProvider is now in root layout (app/layout.tsx)
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPosCashier = POS_CASHIER_PATH.test(pathname ?? "");

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
                  overflow instead of trailing it.

                  POS Cashier is the one page that wants the opposite: it
                  fills the viewport exactly, edge to edge, and manages its
                  own internal scroll regions (menu grid, cart) instead of
                  scrolling as a whole — h-full (not min-h-full) hands its
                  root flex-1 (flex-basis 0) a genuinely *definite* height to
                  size against, and pb-0 (not p-*'s default bottom) drops the
                  trailing gap this same div gives every other page. */}
              <div
                className={cn(
                  "flex flex-col p-2 md:p-6",
                  isPosCashier ? "h-full pb-0 md:pb-0" : "min-h-full"
                )}
              >
                <UpgradeGateProvider>{children}</UpgradeGateProvider>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
