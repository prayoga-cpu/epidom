import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useContext } from "react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/features/dashboard/shared/hooks/use-current-store", () => ({
  useCurrentStore: () => ({ store: { name: "Cafe Central" } }),
}));
vi.mock("@/features/pos/components/pos-printer-menu", () => ({
  PosPrinterMenu: () => <button aria-label="printer" />,
}));

import { PosModeStatusBar } from "../pos-mode-status-bar";
import { PosModeShell } from "../pos-mode-shell";
import { PosModeToolbarSlotContext } from "../pos-mode-toolbar-slot";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";

// The shell also mounts these; they are irrelevant to the bar.
vi.mock("../pos-mode-tab-bar", () => ({ PosModeTabBar: () => null }));
vi.mock("../pos-mode-overflow-menu", () => ({ PosModeOverflowMenu: () => null }));
vi.mock("../pos-mode-upgrade-banner", () => ({
  PosModeUpgradeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PosModeUpgradeBanner: () => null,
}));

beforeEach(() => {
  localStorage.clear();
  usePosSession.setState({
    isActive: true,
    storeId: "store-1",
    staffId: "staff-1",
    staffName: "Sam",
    staffRole: "CASHIER",
    pickerOpen: false,
  });
});

describe("PosModeStatusBar — switch user", () => {
  it("the staff badge is a real, labelled button of at least 40px", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    const button = screen.getByRole("button", { name: /cashierCheckout\.topBar\.switchUser/ });
    expect(button).toHaveTextContent("Sam");
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("h-10");
  });

  it("tapping it opens the existing Switch Account picker without ending the session", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    expect(usePosSession.getState().pickerOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /cashierCheckout\.topBar\.switchUser/ }));
    expect(usePosSession.getState().pickerOpen).toBe(true);
    // The current persona stays logged in underneath, so backing out needs no PIN.
    expect(usePosSession.getState().isActive).toBe(true);
    expect(usePosSession.getState().staffName).toBe("Sam");
  });

  it("no persona, no button", () => {
    usePosSession.setState({ isActive: false, staffName: null, staffRole: null });
    render(<PosModeStatusBar storeId="store-1" />);
    expect(screen.queryByRole("button", { name: /switchUser/ })).toBeNull();
  });
});

describe("PosModeStatusBar — one 44px row", () => {
  it("keeps the store name for screen readers but drops the text below lg", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    const name = screen.getByRole("heading", { name: "Cafe Central" });
    expect(name.className).toContain("sr-only");
    expect(name.className).toContain("lg:not-sr-only");
  });

  it("is 44px tall and exposes a slot between the store name and the right-hand controls", () => {
    const ref = vi.fn();
    render(<PosModeStatusBar storeId="store-1" toolbarSlotRef={ref} />);
    expect(screen.getByRole("banner").className).toContain("h-11");
    const slot = screen.getByTestId("pos-toolbar-slot");
    expect(ref).toHaveBeenCalledWith(slot);
    // Only shown from md up, where /pos portals its toolbar into it; min-w-0 flex-1 so it can shrink.
    expect(slot.className).toContain("hidden");
    expect(slot.className).toContain("md:flex");
    expect(slot.className).toContain("min-w-0");
    expect(slot.className).toContain("flex-1");
  });
});

describe("PosModeShell — provides the slot to /pos", () => {
  function Probe() {
    const slot = useContext(PosModeToolbarSlotContext);
    return (
      <div data-testid="probe">{`${slot.available}:${slot.element?.getAttribute("data-testid")}`}</div>
    );
  }

  it("hands children the status bar's slot node once it has mounted", () => {
    render(
      <PosModeShell storeId="store-1">
        <Probe />
      </PosModeShell>
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("true:pos-toolbar-slot");
  });

  it("keeps the flex/min-h-0/overflow chain: a definite-height column with a shrinkable, clipped main", () => {
    const { container } = render(
      <PosModeShell storeId="store-1">
        <div>page</div>
      </PosModeShell>
    );
    const column = container.firstElementChild as HTMLElement;
    expect(column.className).toContain("flex");
    expect(column.className).toContain("flex-col");
    expect(column.className).toContain("overflow-hidden");
    expect(column.className).toContain("h-[calc(100dvh/var(--app-zoom,1))]");
    const main = container.querySelector("main#main-content") as HTMLElement;
    expect(main.className).toContain("min-h-0");
    expect(main.className).toContain("flex-1");
    expect(main.className).toContain("overflow-hidden");
  });
});
