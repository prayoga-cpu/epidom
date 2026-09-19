import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act, cleanup } from "@testing-library/react";
import type { PosMenuCategory } from "../../types/pos.types";

const STRINGS: Record<string, string> = {
  "cashierCheckout.scan.added": "Added {name}",
  "cashierCheckout.scan.unavailable": "{name} is unavailable",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => STRINGS[k] ?? k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    formatPrice: (v: number, currency: string) => `${currency} ${Number(v).toFixed(2)}`,
  }),
}));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => true }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

// Everything around the menu is out of scope here.
vi.mock("../pos-header", () => ({ PosHeader: () => null }));
vi.mock("../pos-cart", () => ({ PosCart: () => null }));
vi.mock("../pos-mobile-cart", () => ({ PosMobileCart: () => null }));
vi.mock("../pos-offline-banner", () => ({ PosOfflineBanner: () => null }));
vi.mock("../pos-unpaid-alert", () => ({ PosUnpaidAlert: () => null }));
vi.mock("../../hooks/use-pos-orders", () => ({ usePosOrders: () => ({ data: [] }) }));
vi.mock("../../hooks/use-customer-display", () => ({
  useCustomerDisplayPublisher: () => undefined,
}));
vi.mock("@/components/shared/menu-item-options-dialog", () => ({
  MenuItemOptionsDialog: ({ itemName, open }: { itemName: string; open: boolean }) =>
    open ? <div data-testid="options-dialog">{itemName}</div> : null,
}));

const menu = vi.hoisted(() => ({ categories: [] as PosMenuCategory[] }));
vi.mock("../../hooks/use-pos-menu", () => ({
  usePosMenu: () => ({
    data: {
      categories: menu.categories,
      total: 0,
      customProductsEnabled: false,
      customProductsLabel: null,
    },
    isLoading: false,
  }),
}));

import { PosShell } from "../pos-shell";
import { PosModeToolbarSlotContext } from "@/features/pos-mode/pos-mode-toolbar-slot";
import { usePosCart } from "../../hooks/use-pos-cart";
import { usePosViewMode } from "../../hooks/use-pos-view-mode";
import { usePosScannerSettings } from "../../hooks/use-pos-scanner-settings";

const store = { id: "store-1", name: "Cafe" };

const categoriesFixture = (): PosMenuCategory[] => [
  {
    name: "Mains",
    items: [
      { id: "m-ramen", name: "Ramen", price: 12.5, isAvailable: true, barcode: "5901234123457" },
      { id: "m-cake", name: "Cake", price: 5, isAvailable: false, barcode: "4006381333931" },
      {
        id: "m-latte",
        name: "Latte",
        price: 4,
        isAvailable: true,
        barcode: "7350053850019",
        product: {
          optionGroups: [
            {
              name: "Size",
              isRequired: true,
              maxSelections: 1,
              options: [{ name: "Large", priceAdjustment: 1 }],
            },
          ],
        },
      },
      { id: "m-tea", name: "Tea", price: 3, isAvailable: true },
    ],
  },
];

function setViewport(mdOrWider: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("min-width: 768px") ? mdOrWider : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderShell(slot?: { available: boolean; element: HTMLElement | null }) {
  const tree = <PosShell store={store} />;
  return render(
    slot ? (
      <PosModeToolbarSlotContext.Provider value={slot}>{tree}</PosModeToolbarSlotContext.Provider>
    ) : (
      tree
    )
  );
}

const search = () => screen.getByPlaceholderText("pos.menu.search") as HTMLInputElement;

/** A wedge-scanner burst (10ms between keys unless `gap` says otherwise), then Enter, with controlled event timestamps. */
function scan(code: string, start = 1000, gap = 10) {
  const press = (key: string, at: number) => {
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "timeStamp", { value: at });
    act(() => {
      document.body.dispatchEvent(ev);
    });
    return ev;
  };
  [...code].forEach((c, i) => press(c, start + i * gap));
  return press("Enter", start + code.length * gap);
}

beforeEach(() => {
  localStorage.clear();
  usePosCart.getState().clearCart();
  usePosViewMode.setState({ viewMode: "grid" });
  usePosScannerSettings.setState({ enabled: true, speed: "standard" });
  menu.categories = categoriesFixture();
  setViewport(false);
});

afterEach(() => {
  // Unmount first: the scanner panel is a Radix popover portaled into <body>, and
  // wiping the body underneath a still-mounted tree makes React's own cleanup throw.
  cleanup();
  document.body.innerHTML = "";
});

describe("PosShell toolbar — one bar at ≥md, its own row below", () => {
  it("below md the toolbar renders inline, hidden by CSS at md+ only because a slot exists to take over", () => {
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    renderShell({ available: true, element: slot });

    expect(slot).not.toContainElement(search());
    const row = search().closest("div.border-b") as HTMLElement;
    expect(row.className).toContain("md:hidden");
    expect(
      within(row).getByRole("button", { name: "cashierCheckout.scan.focus" })
    ).toBeInTheDocument();
  });

  it("at md+ the search, filters and scan button are portaled into the status bar's slot — the view toggle is not", () => {
    setViewport(true);
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    renderShell({ available: true, element: slot });

    expect(slot).toContainElement(search());
    expect(
      within(slot).getByRole("button", { name: "cashierCheckout.scan.focus" })
    ).toBeInTheDocument();
    expect(within(slot).queryByRole("group", { name: "cashierCheckout.view.label" })).toBeNull();
    // Still on screen — down in the menu container instead.
    expect(screen.getByRole("group", { name: "cashierCheckout.view.label" })).toBeInTheDocument();
    expect(
      within(slot).getByRole("button", { name: /pos\.filters\.addFilter/ })
    ).toBeInTheDocument();
    // Exactly one search box on screen: no second row underneath.
    expect(screen.getAllByPlaceholderText("pos.menu.search")).toHaveLength(1);
  });

  it("in the status bar the search field is a flat, full-height block — square, no border, no margin", () => {
    setViewport(true);
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    renderShell({ available: true, element: slot });

    const field = search();
    expect(field.className).toContain("h-full");
    expect(field.className).toContain("rounded-none");
    expect(field.className).toContain("border-0");
    expect(field.className).not.toContain("h-10");

    // "+ Add filter" is ghost: no border, dashed or otherwise, square corners, a
    // pointer cursor — and as tall as the bar, so its hover tint is a flat block.
    // (h-full, not `self-stretch`: a class no other file uses can be missing from a
    // browser holding an older stylesheet.)
    const add = within(slot).getByRole("button", { name: /pos\.filters\.addFilter/ });
    expect(add.className).not.toMatch(/\bborder\b|border-dashed/);
    expect(add.className).toContain("rounded-none");
    expect(add.className).not.toContain("rounded-md");
    expect(add.className).toContain("cursor-pointer");
    expect(add.className).toContain("h-full");
    expect(add.className).not.toContain("h-9");
    expect(add.className).not.toContain("self-stretch");
  });

  it('outside the status bar, "+ Add filter" keeps its normal 36px height', () => {
    renderShell(); // no slot → the inline row
    const add = screen.getByRole("button", { name: /pos\.filters\.addFilter/ });
    expect(add.className).toContain("h-9");
    expect(add.className).not.toContain("h-full");
  });

  it("the portaled controls still work (state stays in the shell)", () => {
    setViewport(true);
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    const { container } = renderShell({ available: true, element: slot });

    fireEvent.change(search(), { target: { value: "ram" } });
    expect(screen.getByText("Ramen")).toBeInTheDocument();
    expect(screen.queryByText("Tea")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.view.list" }));
    expect(container.querySelector('[data-view-mode="list"]')).not.toBeNull();
  });

  it("the frame before the status bar mounts its slot node shows neither bar (no double toolbar)", () => {
    setViewport(true);
    renderShell({ available: true, element: null });
    const row = search().closest("div.border-b") as HTMLElement;
    expect(row.className).toContain("md:hidden");
  });

  it("without a PosModeShell there is no slot, so the inline row is never hidden", () => {
    setViewport(true);
    renderShell();
    const row = search().closest("div.border-b") as HTMLElement;
    expect(row.className).not.toContain("md:hidden");
  });

  it("controls in the toolbar are at least 40px", () => {
    renderShell();
    expect(search().className).toContain("h-10");
    expect(screen.getByRole("button", { name: "cashierCheckout.scan.focus" }).className).toContain(
      "size-10"
    );
  });

  it("the view toggle is the first thing in the menu container, ahead of every category", () => {
    const { container } = renderShell();
    const menuArea = container.querySelector("[data-view-mode]") as HTMLElement;
    const group = within(menuArea).getByRole("group", { name: "cashierCheckout.view.label" });
    expect(menuArea.firstElementChild).toContainElement(group);
    const firstHeading = within(menuArea).getAllByRole("heading", { level: 2 })[0];
    expect(group.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // …and no longer in the search toolbar.
    const row = search().closest("div.border-b") as HTMLElement;
    expect(within(row).queryByRole("group", { name: "cashierCheckout.view.label" })).toBeNull();
  });

  it("the scan button sits inside the search box and opens the scanner panel", () => {
    renderShell();
    const scanButton = screen.getByRole("button", { name: "cashierCheckout.scan.focus" });
    expect(search().parentElement).toContainElement(scanButton);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(scanButton);
    const panel = screen.getByRole("dialog", { name: "cashierCheckout.scan.title" });
    expect(
      within(panel).getByPlaceholderText("cashierCheckout.scan.testPlaceholder")
    ).toBeInTheDocument();
    expect(within(panel).getByText("cashierCheckout.scan.settingsTitle")).toBeInTheDocument();
  });

  it("switching the view toggle re-lays the menu out and remembers it", () => {
    const { container } = renderShell();
    expect(container.querySelector('[data-view-mode="grid"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.view.columns" }));
    expect(container.querySelector('[data-view-mode="columns"]')).not.toBeNull();
    expect(usePosViewMode.getState().viewMode).toBe("columns");
  });
});

describe("PosShell — Enter in the search box adds an exact barcode hit", () => {
  const enter = (value: string) => {
    fireEvent.change(search(), { target: { value } });
    return fireEvent.keyDown(search(), { key: "Enter" });
  };

  it("adds the item exactly like a tap, clears the box and confirms", () => {
    renderShell();
    enter("5901234123457");
    const items = usePosCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      menuItemId: "m-ramen",
      name: "Ramen",
      quantity: 1,
      unitPrice: 12.5,
    });
    expect(search().value).toBe("");
    expect(toast.success).toHaveBeenCalledWith("Added Ramen", expect.anything());
  });

  it("scanning the same code again adds another unit", () => {
    renderShell();
    enter("5901234123457");
    enter("5901234123457");
    expect(usePosCart.getState().items[0].quantity).toBe(2);
  });

  it("a code with no exact hit is left alone as an ordinary search", () => {
    renderShell();
    enter("59012");
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(search().value).toBe("59012");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // …and the box filtered the grid by barcode as it was typed.
    expect(screen.getByText("Ramen")).toBeInTheDocument();
    expect(screen.queryByText("Tea")).toBeNull();
  });

  it("a name typed and submitted never adds anything", () => {
    renderShell();
    enter("Ramen");
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(search().value).toBe("Ramen");
  });

  it("an item with option groups opens its options dialog instead of adding blindly", () => {
    renderShell();
    enter("7350053850019");
    expect(screen.getByTestId("options-dialog")).toHaveTextContent("Latte");
    expect(usePosCart.getState().items).toHaveLength(0);
    // The dialog is the feedback; no false "Added" toast.
    expect(toast.success).not.toHaveBeenCalled();
    expect(search().value).toBe("");
  });

  it("an unavailable item is refused with a reason, like its disabled tile", () => {
    renderShell();
    enter("4006381333931");
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith("Cake is unavailable");
  });

  it("other keys and an empty box do nothing", () => {
    renderShell();
    fireEvent.change(search(), { target: { value: "5901234123457" } });
    fireEvent.keyDown(search(), { key: "a" });
    expect(usePosCart.getState().items).toHaveLength(0);
    fireEvent.change(search(), { target: { value: "  " } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(usePosCart.getState().items).toHaveLength(0);
  });
});

describe("PosShell — a scanner aimed at the page", () => {
  it("adds a recognised code and swallows the scanner's Enter", () => {
    renderShell();
    const enter = scan("5901234123457");
    expect(usePosCart.getState().items).toHaveLength(1);
    expect(usePosCart.getState().items[0].menuItemId).toBe("m-ramen");
    expect(enter.defaultPrevented).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Added Ramen", expect.anything());
  });

  it("toasts when no item carries that barcode", () => {
    renderShell();
    scan("0000000000000");
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith("cashierCheckout.scan.noMatch");
  });

  it("does not double-add when the scan lands in the search box (its own Enter handles that)", () => {
    renderShell();
    search().focus();
    // Same burst, but the target is the focused search input.
    const press = (key: string, at: number) => {
      const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      Object.defineProperty(ev, "timeStamp", { value: at });
      search().dispatchEvent(ev);
    };
    [..."5901234123457"].forEach((c, i) => press(c, 1000 + i * 10));
    press("Enter", 2000);
    // The hook ignored it; nothing was added by the global path.
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("ignores a scan while a dialog is open", () => {
    renderShell();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    scan("5901234123457");
    expect(usePosCart.getState().items).toHaveLength(0);
  });

  it("ignores a page-wide scan while the scanner panel is open, so a test never adds to the sale", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.scan.focus" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    scan("5901234123457");
    expect(usePosCart.getState().items).toHaveLength(0);
  });

  it("stops listening page-wide when 'scan anywhere' is switched off", () => {
    usePosScannerSettings.setState({ enabled: false });
    renderShell();
    scan("5901234123457");
    expect(usePosCart.getState().items).toHaveLength(0);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a slow scanner is missed at Standard speed and read once set to Slow", () => {
    // 100ms between keys: over the 50ms Standard limit, under Slow's 120ms.
    renderShell();
    scan("5901234123457", 1000, 100);
    expect(usePosCart.getState().items).toHaveLength(0);

    act(() => usePosScannerSettings.setState({ speed: "slow" }));
    scan("5901234123457", 5000, 100);
    expect(usePosCart.getState().items).toHaveLength(1);
    expect(usePosCart.getState().items[0].menuItemId).toBe("m-ramen");
  });
});
