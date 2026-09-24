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
const nav = vi.hoisted(() => ({ pathname: "/store/store-1/pos" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
// Has its own test (pos-mode-shift-chip.test.tsx); it needs a query client this
// file's bar-layout assertions have no reason to set up.
vi.mock("../pos-mode-shift-chip", () => ({ PosModeShiftChip: () => null }));

import { PosModeStatusBar } from "../pos-mode-status-bar";
import { PosModeShell } from "../pos-mode-shell";
import { PosModeToolbarSlotContext } from "../pos-mode-toolbar-slot";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";

// The shell also mounts these; they are irrelevant to the bar.
vi.mock("../pos-mode-tab-bar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pos-mode-tab-bar")>()),
  PosModeTabBar: () => null,
}));
vi.mock("../pos-mode-overflow-menu", () => ({ PosModeOverflowMenu: () => null }));
vi.mock("../pos-mode-upgrade-banner", () => ({
  PosModeUpgradeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PosModeUpgradeBanner: () => null,
}));

beforeEach(() => {
  nav.pathname = "/store/store-1/pos";
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
    expect(button.className).toContain("min-h-10");
  });

  it("the staff badge is a square block flush with the bar's right edge and full height", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    const button = screen.getByRole("button", { name: /cashierCheckout\.topBar\.switchUser/ });
    expect(button.className).toContain("rounded-none");
    expect(button.className).not.toContain("rounded-full");
    expect(button.className).toContain("cursor-pointer");

    // Full height comes from the bar's DEFAULT flex alignment (stretch), so the
    // button must not pin its own height…
    expect(button.className).not.toMatch(/(^|\s)h-(\d|\[|px|full)/);
    // …and neither the bar nor the button's group may vertically center their
    // children, or each would keep its own height and leave a gap top and bottom.
    // (Deliberately not `self-stretch`: a class no other file uses can be missing
    // from a browser holding an older stylesheet, which reopened exactly that gap.)
    const bar = screen.getByRole("banner");
    expect(bar.className).not.toContain("items-center");
    expect(button.parentElement!.className).not.toContain("items-center");
    expect(button.className).not.toContain("self-stretch");

    // The bar leaves no right padding between the button and the edge.
    expect(bar.className).not.toMatch(/\bpx-3\b|\bpr-/);
  });

  it("the toolbar slot is stretched by the bar too, so /pos's search field can fill it", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    const slot = screen.getByTestId("pos-toolbar-slot");
    expect(slot.className).not.toContain("items-center");
    expect(slot.className).not.toMatch(/(^|\s)h-\d/);
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

  it("shows the name only, not the role", () => {
    render(<PosModeStatusBar storeId="store-1" />);
    const button = screen.getByRole("button", { name: /cashierCheckout\.topBar\.switchUser/ });
    expect(button).not.toHaveTextContent("CASHIER");
  });

  it("no persona, no button", () => {
    usePosSession.setState({ isActive: false, staffName: null, staffRole: null });
    render(<PosModeStatusBar storeId="store-1" />);
    expect(screen.queryByRole("button", { name: /switchUser/ })).toBeNull();
  });
});

describe("PosModeStatusBar — printers", () => {
  it.each(["/pos", "/pos/orders", "/pos/kds", "/tables"])(
    "offers the printer menu on the POS System (%s)",
    (path) => {
      nav.pathname = `/store/store-1${path}`;
      render(<PosModeStatusBar storeId="store-1" />);
      expect(screen.getByRole("button", { name: "printer" })).toBeInTheDocument();
    }
  );

  it("leaves it off the Operational page — Hardware settings still reaches the printers", () => {
    nav.pathname = "/store/store-1/pos/operational";
    render(<PosModeStatusBar storeId="store-1" />);
    expect(screen.queryByRole("button", { name: "printer" })).toBeNull();
  });
});

describe("PosModeStatusBar — More menu", () => {
  it("sits right of the staff badge, flush with the bar's right edge, with no visible label", () => {
    const onOverflowClick = vi.fn();
    render(<PosModeStatusBar storeId="store-1" onOverflowClick={onOverflowClick} />);
    const more = screen.getByRole("button", { name: "common.actions.more" });
    const staff = screen.getByRole("button", { name: /cashierCheckout\.topBar\.switchUser/ });
    expect(staff.nextElementSibling).toBe(more);
    expect(more.parentElement!.lastElementChild).toBe(more);
    // The badge and the More button touch — no gap between them.
    expect(more.parentElement!.className).not.toMatch(/(^|\s)gap-/);
    expect(more).toHaveTextContent("");
    // The Epidom mark, then the hamburger to its right.
    const icons = more.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    expect(icons[1]!.getAttribute("class")).toContain("lucide-menu");
    expect(more.className).not.toMatch(/(^|\s)h-(\d|\[|px|full)/);

    fireEvent.click(more);
    expect(onOverflowClick).toHaveBeenCalledTimes(1);
  });

  it("stays reachable with no persona", () => {
    usePosSession.setState({ isActive: false, staffName: null, staffRole: null });
    render(<PosModeStatusBar storeId="store-1" onOverflowClick={() => {}} />);
    expect(screen.getByRole("button", { name: "common.actions.more" })).toBeInTheDocument();
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
