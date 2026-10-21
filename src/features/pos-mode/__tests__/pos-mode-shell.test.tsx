/**
 * The bottom tab bar is the POS System's; the Operational page keeps the rest of
 * the shell (the status bar and its shift chip) but not the bar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/store/store-1/pos" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
// Has its own test; needs the router and a query client this layout test doesn't set up.
vi.mock("@/features/dashboard/shared/notification-bell", () => ({
  NotificationBell: () => null,
}));

vi.mock("../pos-mode-status-bar", () => ({
  PosModeStatusBar: () => <div data-testid="status-bar" />,
}));
vi.mock("../pos-mode-tab-bar", () => ({
  PosModeTabBar: ({ variant = "bottom" }: { variant?: "bottom" | "side" }) => (
    <nav data-testid="tab-bar" data-variant={variant} />
  ),
}));
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

// Two renderings of the same tabs: a side rail (landscape tablets) and the
// bottom bar (everything else); CSS shows exactly one of them.
const tabBarVariants = () =>
  screen.queryAllByTestId("tab-bar").map((bar) => bar.getAttribute("data-variant"));

describe("PosModeShell — the tab bar belongs to the POS System", () => {
  it.each([
    "/store/store-1/pos",
    "/store/store-1/pos/orders",
    "/store/store-1/pos/kds",
    "/store/store-1/tables",
  ])("shows it on %s", (path) => {
    renderAt(path);
    expect(tabBarVariants()).toEqual(["side", "bottom"]);
  });

  it("puts the side rail left of the page and the bottom bar under it", () => {
    renderAt("/store/store-1/pos");
    const [side, bottom] = screen.getAllByTestId("tab-bar");
    const main = screen.getByRole("main");
    expect(side.nextElementSibling).toBe(main);
    expect(main.parentElement!.nextElementSibling).toBe(bottom);
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
    expect(tabBarVariants()).toEqual(["side", "bottom"]);
  });

  it("only hides it for this store's Operational page", () => {
    renderAt("/store/store-2/pos/operational");
    expect(tabBarVariants()).toEqual(["side", "bottom"]);
  });
});
