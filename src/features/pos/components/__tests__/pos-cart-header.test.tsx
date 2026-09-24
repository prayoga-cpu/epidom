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

import { PosCartHeader } from "../pos-cart-header";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
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
