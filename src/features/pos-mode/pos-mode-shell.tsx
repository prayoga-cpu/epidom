"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { usePathname } from "next/navigation";
import { PosModeStatusBar } from "./pos-mode-status-bar";
import { PosModeTabBar } from "./pos-mode-tab-bar";
import { PosModeOverflowMenu } from "./pos-mode-overflow-menu";
import { PosModeUpgradeProvider, PosModeUpgradeBanner } from "./pos-mode-upgrade-banner";
import { PosModeToolbarSlotContext } from "./pos-mode-toolbar-slot";

interface PosModeShellProps {
  storeId: string;
  children: React.ReactNode;
  /** Signed in as a staff member's own linked account — see PosModeOverflowMenu. */
  linkedStaff?: boolean;
}

/**
 * POS Mode's shell chrome — status bar, upgrade banner, tab bar. No
 * Topbar/Sidebar import: this is a separate shell from Back Office's
 * PageShell, not a responsive variant of it (docs/dashboard-revamp.md).
 * src/features/pos/ (the cashier/order/kds/tables feature module) is
 * wrapped here, not rewritten.
 *
 * The tab bar belongs to the POS System (cashier, orders, kitchen & bar,
 * tables). The Operational page (Shift, My Schedule, Clock In / Out) keeps the
 * status bar — its shift chip keeps the session's till in sync on every route —
 * but not the tab bar; the drawer's POS System row leads back.
 */
export function PosModeShell({ storeId, children, linkedStaff = false }: PosModeShellProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  // Null outside a router (some tests): keep the bar, the old behaviour.
  const pathname = usePathname();
  const onOperational = pathname?.startsWith(`/store/${storeId}/pos/operational`) ?? false;
  // The status bar's toolbar slot, handed to children through context so /pos can
  // portal its search + filters into the bar instead of drawing a second row.
  // Held as state (set by a ref callback), not a ref: consumers must re-render
  // once the slot node exists, and a ref change wouldn't tell them.
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const slot = useMemo(() => ({ available: true, element: toolbarSlot }), [toolbarSlot]);

  return (
    <PosModeUpgradeProvider>
      <PosModeToolbarSlotContext.Provider value={slot}>
        <div className="flex h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col overflow-hidden">
          <PosModeStatusBar
            storeId={storeId}
            toolbarSlotRef={setToolbarSlot}
            onOverflowClick={() => setOverflowOpen(true)}
          />
          <PosModeUpgradeBanner />

          <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>

          {!onOperational && <PosModeTabBar storeId={storeId} />}
        </div>
      </PosModeToolbarSlotContext.Provider>

      <PosModeOverflowMenu
        storeId={storeId}
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        linkedStaff={linkedStaff}
      />
    </PosModeUpgradeProvider>
  );
}
