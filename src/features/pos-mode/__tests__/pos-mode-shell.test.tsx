/**
 * The bottom tab bar is the POS System's; the Operational page keeps the rest of
 * the shell (the status bar and its shift chip) but not the bar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/store/store-1/pos" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

vi.mock("../pos-mode-status-bar", () => ({
  PosModeStatusBar: () => <div data-testid="status-bar" />,
}));
vi.mock("../pos-mode-tab-bar", () => ({ PosModeTabBar: () => <nav data-testid="tab-bar" /> }));
vi.mock("../pos-mode-overflow-menu", () => ({ PosModeOverflowMenu: () => null }));
vi.mock("../pos-mode-upgrade-banner", () => ({
  PosModeUpgradeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PosModeUpgradeBanner: () => null,
}));

import { PosModeShell } from "../pos-mode-shell";

const renderAt = (pathname: string | null) => {
  nav.pathname = pathname;
  return render(
    <PosModeShell storeId="store-1">
      <div>page</div>
    </PosModeShell>
  );
};

describe("PosModeShell — the tab bar belongs to the POS System", () => {
  it.each([
    "/store/store-1/pos",
    "/store/store-1/pos/orders",
    "/store/store-1/pos/kds",
    "/store/store-1/tables",
  ])("shows it on %s", (path) => {
    renderAt(path);
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });

  it("leaves it off the Operational page, whatever tab — but keeps the status bar", () => {
    const first = renderAt("/store/store-1/pos/operational");
    expect(screen.queryByTestId("tab-bar")).toBeNull();
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    first.unmount();

    renderAt("/store/store-1/pos/operational?tab=clock");
    expect(screen.queryByTestId("tab-bar")).toBeNull();
  });

  it("keeps it when the path isn't known (no router)", () => {
    renderAt(null);
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });

  it("only hides it for this store's Operational page", () => {
    renderAt("/store/store-2/pos/operational");
    expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
  });
});
