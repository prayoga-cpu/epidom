"use client";

import { useState } from "react";
import type React from "react";
import { PosModeStatusBar } from "./pos-mode-status-bar";
import { PosModeTabBar } from "./pos-mode-tab-bar";
import { PosModeOverflowMenu } from "./pos-mode-overflow-menu";
import { PosModeUpgradeProvider, PosModeUpgradeBanner } from "./pos-mode-upgrade-banner";

interface PosModeShellProps {
  storeId: string;
  children: React.ReactNode;
}

/**
 * POS Mode's shell chrome — status bar, upgrade banner, tab bar. No
 * Topbar/Sidebar import: this is a separate shell from Back Office's
 * PageShell, not a responsive variant of it (docs/dashboard-revamp.md).
 * src/features/pos/ (the cashier/order/kds/tables feature module) is
 * wrapped here, not rewritten.
 */
export function PosModeShell({ storeId, children }: PosModeShellProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <PosModeUpgradeProvider>
      <div className="flex h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col overflow-hidden">
        <PosModeStatusBar storeId={storeId} />
        <PosModeUpgradeBanner />

        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>

        <PosModeTabBar storeId={storeId} onOverflowClick={() => setOverflowOpen(true)} />
      </div>

      <PosModeOverflowMenu storeId={storeId} open={overflowOpen} onOpenChange={setOverflowOpen} />
    </PosModeUpgradeProvider>
  );
}
