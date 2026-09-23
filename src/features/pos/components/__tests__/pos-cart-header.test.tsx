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

import { PosCartHeader } from "../pos-cart-header";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  queue.orders = [];
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

describe("PosCartHeader — Dine In | Take Away", () => {
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

  it("gives each half of the switch a >=40px tap target", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Dine In" }).className).toContain("h-10");
    expect(screen.getByRole("radio", { name: "Take Away" }).className).toContain("h-10");
  });

  it("shows the pax/table chip only for Dine In", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: "cashierCart.header.paxTableLabel" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Take Away" }));
    expect(screen.queryByRole("button", { name: "cashierCart.header.paxTableLabel" })).toBeNull();
  });

  it("the chip reads '2 pax · Table A1' and edits guests and table in a popover", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    const chip = () => screen.getByRole("button", { name: "cashierCart.header.paxTableLabel" });
    expect(chip().textContent).toBe("1 pax");

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" }));
    fireEvent.change(screen.getByLabelText("pos.checkout.tableOptional"), {
      target: { value: "A1" },
    });

    expect(cart().guestCount).toBe(2);
    expect(cart().tableNumber).toBe("A1");
    expect(chip().textContent).toBe("2 pax · Table A1");
  });

  it("does not close the popover after a stepper change (the cashier bumps it several times)", () => {
    render(<PosCartHeader storeId="store_1" onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.header.paxTableLabel" }));
    const inc = () => screen.getByRole("button", { name: "pos.checkout.guestCountIncrease" });
    fireEvent.click(inc());
    fireEvent.click(inc());
    fireEvent.click(inc());
    expect(cart().guestCount).toBe(4);
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
