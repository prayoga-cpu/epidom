import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const queue = vi.hoisted(() => ({ orders: [] as Array<{ id: string }> }));
vi.mock("../../hooks/use-pos-orders-snapshot", () => ({
  usePosOrdersSnapshot: () => ({ data: queue.orders }),
}));

const finance = vi.hoisted(() => ({ market: "INDONESIA" as string | undefined }));
vi.mock("@/features/dashboard/profile/hooks/use-finance-settings", () => ({
  useFinanceSettings: () => ({ data: finance.market ? { market: finance.market } : undefined }),
}));

vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  const value = makeCurrencyMock("EUR");
  return { useCurrency: () => value };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { PosCartHeader } from "../pos-cart-header";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  usePosCart.setState({ heldSales: {} });
  vi.mocked(toast.success).mockClear();
  queue.orders = [];
  finance.market = "INDONESIA";
});

describe("PosCartHeader — Order Queue", () => {
  it("links to the store's order queue, labelled 'Order Queue'", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    const link = screen.getByRole("link", { name: /Order Queue/ });
    expect(link.getAttribute("href")).toBe("/store/store_1/pos/orders");
  });

  it("shows the number of orders in the active queue as a badge", () => {
    queue.orders = [{ id: "a" }, { id: "b" }, { id: "c" }];
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.getByTestId("order-queue-count").textContent).toBe("3");
  });

  it("hides the badge when the queue is empty", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.queryByTestId("order-queue-count")).toBeNull();
  });

  it("closes the mobile cart dialog when the link is followed", () => {
    const onClose = vi.fn();
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("link", { name: /Order Queue/ }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("PosCartHeader — Active Queue off", () => {
  /** Rings up a sale and holds it, as the footer's Hold does. */
  const holdSale = (menuItemId: string, name: string, price: number) => {
    cart().addItem(menuItemId, name, price, 1);
    expect(cart().holdSale("store_1")).toBe(true);
  };
  const resumeButton = () =>
    screen.getByRole("button", { name: /cashierCart\.header\.resumeHold/ });

  it("labels the orders link 'Order Log' — the page is only the Log then", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} activeQueueEnabled={false} />);
    const link = screen.getByRole("link", { name: /cashierCart\.header\.orderLog/ });
    expect(link.getAttribute("href")).toBe("/store/store_1/pos/orders");
  });

  it("becomes Resume hold while this till holds a sale, and one tap brings it back", () => {
    holdSale("m1", "Croissant", 3);
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} activeQueueEnabled={false} />);
    expect(screen.queryByRole("link", { name: /Order|cashierCart/ })).toBeNull();
    expect(screen.getByTestId("held-sales-count").textContent).toBe("1");

    fireEvent.click(resumeButton());

    expect(cart().items.map((i) => i.name)).toEqual(["Croissant"]);
    // Nothing left held: the plain orders link is back.
    expect(screen.getByRole("link", { name: /cashierCart\.header\.orderLog/ })).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("with several holds, lists them newest first with their totals", () => {
    holdSale("m1", "Croissant", 3);
    holdSale("m2", "Baguette", 2);
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} activeQueueEnabled={false} />);
    expect(screen.getByTestId("held-sales-count").textContent).toBe("2");

    fireEvent.keyDown(resumeButton(), { key: "Enter" });
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^Baguette.*EUR 2\.00$/),
      expect.stringMatching(/^Croissant.*EUR 3\.00$/),
    ]);

    fireEvent.click(items[1]);
    expect(cart().items.map((i) => i.name)).toEqual(["Croissant"]);
    expect(cart().heldSales.store_1.map((h) => h.cart.items[0].name)).toEqual(["Baguette"]);
  });

  it("holds the open sale in its place when another one is resumed", () => {
    holdSale("m1", "Croissant", 3);
    cart().addItem("m2", "Baguette", 2, 1);
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} activeQueueEnabled={false} />);

    fireEvent.click(resumeButton());

    expect(cart().items.map((i) => i.name)).toEqual(["Croissant"]);
    expect(cart().heldSales.store_1.map((h) => h.cart.items[0].name)).toEqual(["Baguette"]);
    expect(toast.success).toHaveBeenCalledWith("cashierCart.hold.swapped");
  });

  it("names a held sale after its customer, else its table", () => {
    cart().addItem("m1", "Croissant", 3, 1);
    cart().setCustomer({
      id: "c1",
      name: "Budi",
      phone: null,
      email: null,
      points: 0,
      lifetimeSpend: 0,
    });
    cart().holdSale("store_1");
    cart().addItem("m2", "Baguette", 2, 1);
    cart().setTableNumber("7");
    cart().holdSale("store_1");
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} activeQueueEnabled={false} />);

    fireEvent.keyDown(resumeButton(), { key: "Enter" });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].textContent).toMatch(/^Table 7/);
    expect(items[1].textContent).toMatch(/^Budi/);
  });
});

describe("PosCartHeader — Dine In | Take Away | Others", () => {
  /** Radix opens a dropdown on pointer-down or Enter, never on a synthetic click. */
  const openOthers = () =>
    fireEvent.keyDown(screen.getByRole("radio", { name: /cashierCart\.header\.others/ }), {
      key: "Enter",
    });
  const platformNames = () => screen.getAllByRole("menuitemradio").map((item) => item.textContent);

  it("defaults to Dine In and writes the choice into the cart store", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    const dineIn = screen.getByRole("radio", { name: "Dine In" });
    const takeAway = screen.getByRole("radio", { name: "Take Away" });
    expect(dineIn.getAttribute("aria-checked")).toBe("true");
    expect(takeAway.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(takeAway);
    expect(cart().orderType).toBe("TAKEAWAY");
    expect(screen.getByRole("radio", { name: "Take Away" }).getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("gives each of the three segments a >=40px tap target", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const radio of screen.getAllByRole("radio")) expect(radio.className).toContain("h-10");
  });

  it("no longer carries the pax/table chip — that moved to the customer dialog", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.queryByText("1 pax")).toBeNull();
    expect(screen.queryByLabelText("pos.checkout.tableOptional")).toBeNull();
  });

  it("Others lists the Indonesian platforms for an Indonesian store", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    openOthers();
    expect(platformNames()).toEqual([
      "GoFood",
      "GrabFood",
      "ShopeeFood",
      "pos.onlinePlatform.other",
    ]);
  });

  it("Others lists the French platforms for a French store", () => {
    finance.market = "FRANCE";
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    openOthers();
    expect(platformNames()).toEqual([
      "Uber Eats",
      "Deliveroo",
      "Just Eat",
      "pos.onlinePlatform.other",
    ]);
  });

  it("Others lists the US/worldwide platforms for an international store", () => {
    finance.market = "INTERNATIONAL";
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    openOthers();
    expect(platformNames()).toEqual([
      "Uber Eats",
      "DoorDash",
      "Grubhub",
      "pos.onlinePlatform.other",
    ]);
  });

  it("picking a platform makes the sale a DELIVERY for it, and the segment names it", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    openOthers();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GrabFood" }));

    expect(cart().orderType).toBe("DELIVERY");
    expect(cart().onlinePlatform).toBe("GRABFOOD");
    const others = screen.getByRole("radio", { name: /cashierCart\.header\.others/ });
    expect(others.getAttribute("aria-checked")).toBe("true");
    expect(others.textContent).toContain("GrabFood");
    expect(screen.getByRole("radio", { name: "Dine In" }).getAttribute("aria-checked")).toBe(
      "false"
    );
  });

  it("going back to Dine In drops the platform", () => {
    cart().setOnlinePlatform("GOFOOD");
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Dine In" }));
    expect(cart().orderType).toBe("DINE_IN");
    expect(cart().onlinePlatform).toBeNull();
  });

  it("keeps a resumed bill's platform listed even after the market changed", () => {
    finance.market = "FRANCE";
    cart().setOnlinePlatform("GOFOOD");
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    openOthers();
    expect(platformNames()[0]).toBe("GoFood");
  });
});

describe("PosCartHeader — Clear sale", () => {
  it("is disabled while there is nothing to clear", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    const clear = screen.getByRole("button", { name: "cashierCart.header.clearSale" });
    expect((clear as HTMLButtonElement).disabled).toBe(true);
  });

  it("delegates to onClear once the sale has something in it", () => {
    const onClear = vi.fn();
    cart().addItem("m1", "Ramen", 10, 1);
    render(<PosCartHeader storeId="store_1" onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.header.clearSale" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("stays available for a resumed bill even if its lines were all removed", () => {
    cart().hydrateFromOrder([], "order_1");
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "cashierCart.header.clearSale" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});
