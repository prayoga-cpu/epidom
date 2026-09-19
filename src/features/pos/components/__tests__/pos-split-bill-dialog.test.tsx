import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// Keys echo back, except templated strings this suite reads the interpolated text of.
const STRINGS: Record<string, string> = {
  "cashierCheckout.split.billN": "Bill {n}",
  "cashierCheckout.split.payBill": "Pay Bill {n}",
  "cashierCheckout.split.payBillTitle": "Bill {n} · Payment",
  "cashierCheckout.split.undealt": "Left: {count} · {amount}",
  "cashierCheckout.tender.eachShare": "{amount} each",
  "cashierCheckout.tender.lastShare": "last {amount}",
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
vi.mock("@/features/dashboard/profile/hooks/use-finance-settings", () => ({
  useFinanceSettings: () => ({ data: { enabledPaymentMethods: ["CASH", "QRIS"] } }),
}));

const display = vi.hoisted(() => ({ clearCustomerPhone: vi.fn() }));
vi.mock("../../hooks/use-customer-display", () => ({
  clearCustomerPhone: display.clearCustomerPhone,
}));

// Checkout has its own suite. Here it is a probe: it records the props each instance gets and
// exposes the two callbacks the split dialog reacts to.
const checkouts = vi.hoisted(() => ({ bill: null as any, equal: null as any }));
vi.mock("../pos-checkout-dialog", () => ({
  PosCheckoutDialog: (props: any) => {
    const kind = props.onPaid ? "bill" : "equal";
    checkouts[kind as "bill" | "equal"] = props;
    return (
      <div>
        {props.open && (
          <div data-testid={`${kind}-checkout`}>
            <span data-testid={`${kind}-title`}>{props.title ?? ""}</span>
            <button onClick={() => props.onOpenChange(false)}>{`${kind}-close`}</button>
            <button
              onClick={() => {
                props.onPaid?.();
                props.onOpenChange(false);
              }}
            >{`${kind}-paid`}</button>
          </div>
        )}
        {/* In the real checkout this belongs to the order-complete screen, which outlives the
            checkout closing — so it stays here after the checkout itself is gone. */}
        <button onClick={() => props.onDone?.()}>{`${kind}-done`}</button>
      </div>
    );
  },
}));

import { PosSplitBillDialog } from "../pos-split-bill-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

function seedCart() {
  cart().clearCart();
  cart().setFinanceSettings({
    taxEnabled: false,
    taxRate: 0,
    taxInclusive: true,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    processingFeeEnabled: false,
    processingFeeOverrides: null,
  });
  cart().setLoyaltyRules(null);
  cart().addItem("ckramen000000000000000001", "Ramen", 10, 2); // 20
  cart().addItem("cktea00000000000000000001", "Tea", 5, 2); // 10   → 30
}

function renderSplit(over: Partial<React.ComponentProps<typeof PosSplitBillDialog>> = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <PosSplitBillDialog
      open
      onOpenChange={onOpenChange}
      storeId="store-1"
      storeName="Cafe"
      cashierName="Sam"
      shiftId="ckshift00000000000000001"
      {...over}
    />
  );
  return { onOpenChange, ...utils };
}

const more = (name: string) =>
  screen.getByRole("button", { name: `cashierCheckout.split.more — ${name}` });
const fewer = (name: string) =>
  screen.getByRole("button", { name: `cashierCheckout.split.fewer — ${name}` });
const chip = (n: number) => screen.getByRole("button", { name: new RegExp(`^Bill ${n}`) });
const pay = (n: number) => screen.getByRole("button", { name: `Pay Bill ${n}` });
const billTotal = () => screen.getByTestId("split-bill-total");
const parse = (kind: "bill" | "equal") => checkouts[kind];

beforeEach(() => {
  localStorage.clear();
  seedCart();
  checkouts.bill = null;
  checkouts.equal = null;
});

describe("PosSplitBillDialog — by items", () => {
  it("shows an empty state instead of controls for an empty cart", () => {
    cart().clearCart();
    renderSplit();
    expect(screen.getByText("cashierCheckout.split.emptyCart")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("deals units onto a bill with live per-bill totals and shows what is still undealt", () => {
    renderSplit();
    // Bill 1 holds one Ramen (10).
    fireEvent.click(more("Ramen"));
    expect(billTotal()).toHaveTextContent("EUR 10.00");
    expect(chip(1)).toHaveTextContent("EUR 10.00");
    // Two units of Tea also stay undealt: 1 Ramen + 2 Tea = 3 items, EUR 20.00.
    expect(screen.getByTestId("split-remainder")).toHaveTextContent("Left: 3 · EUR 20.00");

    fireEvent.click(more("Tea"));
    fireEvent.click(more("Tea"));
    expect(billTotal()).toHaveTextContent("EUR 20.00");
    expect(screen.getByTestId("split-remainder")).toHaveTextContent("Left: 1 · EUR 10.00");
  });

  it("a line can only be dealt as many times as the cart holds, counting the other bills", () => {
    renderSplit();
    fireEvent.click(more("Ramen"));
    fireEvent.click(more("Ramen"));
    expect(more("Ramen")).toBeDisabled();

    fireEvent.click(chip(2));
    // Both Ramen are on Bill 1 already.
    expect(more("Ramen")).toBeDisabled();
    expect(fewer("Ramen")).toBeDisabled();
    expect(screen.getByText(/cashierCheckout\.split\.onOtherBills/)).toBeInTheDocument();
  });

  it("a bill can only be paid when it is not empty", () => {
    renderSplit();
    expect(pay(1)).toBeDisabled();
    expect(screen.getByText("cashierCheckout.split.emptyBill")).toBeInTheDocument();
    fireEvent.click(more("Tea"));
    expect(pay(1)).toBeEnabled();
  });

  it("stepper buttons are 44px targets", () => {
    renderSplit();
    for (const b of [more("Ramen"), fewer("Ramen")]) expect(b.className).toContain("h-11");
    expect(pay(1).className).toContain("h-12");
  });

  it("Pay Bill opens the ordinary checkout with a basis built from that bill", () => {
    cart().setGuestCount(3);
    renderSplit();
    fireEvent.click(more("Ramen"));
    fireEvent.click(pay(1));

    expect(screen.getByTestId("bill-checkout")).toBeInTheDocument();
    expect(screen.getByTestId("bill-title")).toHaveTextContent("Bill 1 · Payment");
    const { basis } = parse("bill");
    expect(basis).toMatchObject({
      subtotal: 10,
      tax: 0,
      serviceCharge: 0,
      discountAmount: 0,
      total: 10,
      guestCount: 3,
    });
    expect(basis.items).toHaveLength(1);
    expect(basis.items[0]).toMatchObject({ name: "Ramen", quantity: 1, lineTotal: 10 });
    expect(typeof basis.splitGroupId).toBe("string");
    expect(basis.splitGroupId.length).toBeGreaterThan(3);
  });

  it("shares the discount across bills in proportion, exactly", () => {
    cart().setDiscount(6, "Promo"); // 20% of 30
    renderSplit();
    fireEvent.click(more("Ramen")); // Bill 1: 10 → share 2.00
    expect(billTotal()).toHaveTextContent("EUR 8.00");
    expect(screen.getByText("cashierCheckout.split.discountShare")).toBeInTheDocument();
    fireEvent.click(pay(1));
    expect(parse("bill").basis).toMatchObject({
      discountAmount: 2,
      discountReason: "Promo",
      total: 8,
    });
  });

  it("paying a bill takes exactly its lines out of the cart and keeps only the unspent discount", () => {
    cart().setDiscount(6, "Promo");
    renderSplit();
    fireEvent.click(more("Ramen"));
    fireEvent.click(pay(1));
    fireEvent.click(screen.getByText("bill-paid"));

    // One Ramen left, Tea untouched — a reload now shows exactly what is still owed.
    expect(cart().items.map((i) => [i.name, i.quantity])).toEqual([
      ["Ramen", 1],
      ["Tea", 2],
    ]);
    // Bill 1 took 2.00 of the 6.00; 4.00 is left for the remaining 20.00 of items.
    expect(cart().discountSource).toMatchObject({ kind: "manual", amount: 4, reason: "Promo" });
    expect(cart().total).toBe(16);

    // Bill 1 is closed and can't be paid twice.
    expect(chip(1)).toBeDisabled();
    expect(chip(1)).toHaveTextContent("cashierCheckout.split.paid");
  });

  it("paying calls cart.removeLines with exactly that bill's lines and quantities", () => {
    const original = cart().removeLines;
    const spy = vi.fn(original);
    usePosCart.setState({ removeLines: spy });
    try {
      renderSplit();
      const [ramen, tea] = cart().items;
      fireEvent.click(more("Ramen"));
      fireEvent.click(more("Tea"));
      fireEvent.click(more("Tea"));
      fireEvent.click(pay(1));
      fireEvent.click(screen.getByText("bill-paid"));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith([
        { lineId: ramen.id, quantity: 1 },
        { lineId: tea.id, quantity: 2 },
      ]);
    } finally {
      usePosCart.setState({ removeLines: original });
    }
  });

  it("a discount is never applied twice across bills: the shares always add up to the original", () => {
    cart().setDiscount(6, "Promo");
    renderSplit();
    const sharesPaid: number[] = [];

    fireEvent.click(more("Ramen"));
    fireEvent.click(pay(1));
    sharesPaid.push(parse("bill").basis.discountAmount);
    fireEvent.click(screen.getByText("bill-paid"));

    // Bill 2 now: the two Tea.
    fireEvent.click(chip(2));
    fireEvent.click(more("Tea"));
    fireEvent.click(more("Tea"));
    fireEvent.click(pay(2));
    sharesPaid.push(parse("bill").basis.discountAmount);
    fireEvent.click(screen.getByText("bill-paid"));

    // The last Ramen is left in the cart with what remains of the discount.
    const leftover = cart().discountAmount;
    expect(sharesPaid.reduce((a, b) => a + b, 0) + leftover).toBeCloseTo(6, 2);
  });

  it("every bill of one split shares a group id, and only Bill 1 carries the pax", () => {
    cart().setGuestCount(4);
    renderSplit();
    fireEvent.click(more("Tea"));
    fireEvent.click(pay(1));
    const first = parse("bill").basis;
    fireEvent.click(screen.getByText("bill-paid"));

    fireEvent.click(chip(2));
    fireEvent.click(more("Ramen"));
    fireEvent.click(pay(2));
    const second = parse("bill").basis;

    expect(first.guestCount).toBe(4);
    expect(second.guestCount).toBeNull();
    expect(second.splitGroupId).toBe(first.splitGroupId);
    expect(parse("bill").title).toBe("Bill 2 · Payment");
  });

  it("pax stays on Bill 1 even if a later bill is paid first, and is sent once", () => {
    cart().setGuestCount(4);
    renderSplit();
    fireEvent.click(chip(2));
    fireEvent.click(more("Tea"));
    fireEvent.click(pay(2));
    expect(parse("bill").basis.guestCount).toBeNull();
    fireEvent.click(screen.getByText("bill-paid"));

    fireEvent.click(chip(1));
    fireEvent.click(more("Ramen"));
    fireEvent.click(pay(1));
    expect(parse("bill").basis.guestCount).toBe(4);
  });

  it("the last bill leaves an empty cart; dismissing the complete screen resets the sale and closes", () => {
    cart().setCustomer({
      id: "ckcust0000000000000000001",
      name: "Alice",
      phone: null,
      email: null,
      points: 0,
      lifetimeSpend: 0,
    });
    cart().setTableNumber("A1");
    const { onOpenChange } = renderSplit();

    fireEvent.click(more("Ramen"));
    fireEvent.click(more("Ramen"));
    fireEvent.click(more("Tea"));
    fireEvent.click(more("Tea"));
    fireEvent.click(pay(1));
    fireEvent.click(screen.getByText("bill-paid"));
    expect(cart().items).toHaveLength(0);
    expect(screen.getByText("cashierCheckout.split.allPaid")).toBeInTheDocument();

    fireEvent.click(screen.getByText("bill-done"));
    expect(cart().customer).toBeNull();
    expect(cart().tableNumber).toBe("");
    expect(display.clearCustomerPhone).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dismissing the complete screen between bills keeps the split open", () => {
    const { onOpenChange } = renderSplit();
    fireEvent.click(more("Tea"));
    fireEvent.click(pay(1));
    fireEvent.click(screen.getByText("bill-paid"));
    fireEvent.click(screen.getByText("bill-done"));
    expect(cart().items.length).toBeGreaterThan(0);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("adds bills up to six and removes them back down to two", () => {
    renderSplit();
    const addBill = screen.getByRole("button", { name: /cashierCheckout\.split\.addBill/ });
    for (let i = 0; i < 6; i++) fireEvent.click(addBill);
    expect(screen.getAllByRole("button", { name: /^Bill \d/ })).toHaveLength(6);
    expect(addBill).toBeDisabled();

    // The new bill is selected; remove it.
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.split.removeBill" }));
    expect(screen.getAllByRole("button", { name: /^Bill \d/ })).toHaveLength(5);

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.split.removeBill" }));
    }
    expect(screen.getAllByRole("button", { name: /^Bill \d/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "cashierCheckout.split.removeBill" })).toBeDisabled();
  });

  it("removing a bill returns its units to the undealt remainder", () => {
    renderSplit();
    fireEvent.click(screen.getByRole("button", { name: /cashierCheckout\.split\.addBill/ }));
    fireEvent.click(more("Tea")); // onto Bill 3
    expect(screen.queryByTestId("split-remainder")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.split.removeBill" }));
    expect(screen.getByTestId("split-remainder")).toHaveTextContent("Left: 4 · EUR 30.00");
  });

  it("a coupon can't be combined with splitting by items — clear notice, no bills", () => {
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "ckcoupon0000000000000001",
      code: "SAVE5",
      type: "FIXED",
      value: 5,
      minSubtotal: null,
    });
    renderSplit();
    expect(screen.getByRole("alert")).toHaveTextContent("cashierCheckout.split.blockedPromo");
    expect(screen.queryByRole("button", { name: /Pay Bill/ })).toBeNull();
    expect(screen.queryByTestId("split-line")).toBeNull();
  });

  it("redeemed points can't be combined with splitting by items either", () => {
    usePosCart.setState({ pointsRedeemed: 5 });
    renderSplit();
    expect(screen.getByRole("alert")).toHaveTextContent("cashierCheckout.split.blockedPromo");
  });

  it("a resumed Saved bill can't be split by items (it settles whole through finalize)", () => {
    cart().setResumingOrderId("order-9");
    renderSplit();
    expect(screen.getByRole("alert")).toHaveTextContent("cashierCheckout.split.blockedResumed");
    expect(screen.queryByRole("button", { name: /Pay Bill/ })).toBeNull();
  });
});

describe("PosSplitBillDialog — equal split", () => {
  const openEqualTab = () =>
    fireEvent.mouseDown(screen.getByRole("tab", { name: "cashierCheckout.split.tabEqual" }));

  it("previews the shares with the rounding on the last one", () => {
    cart().clearCart();
    cart().addItem("ckramen000000000000000001", "Ramen", 10, 1); // total 10
    renderSplit();
    openEqualTab();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" }));
    expect(screen.getByTestId("equal-parts")).toHaveTextContent("3");
    expect(screen.getByTestId("equal-share")).toHaveTextContent("EUR 3.33 each · last EUR 3.34");
  });

  it("the people stepper stays within 2–10", () => {
    renderSplit();
    openEqualTab();
    expect(
      screen.getByRole("button", { name: "cashierCheckout.tender.fewerPeople" })
    ).toBeDisabled();
    const morePeople = screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" });
    for (let i = 0; i < 12; i++) fireEvent.click(morePeople);
    expect(screen.getByTestId("equal-parts")).toHaveTextContent("10");
    expect(morePeople).toBeDisabled();
  });

  it("pre-fills the cart's tender rows with N equal shares and opens the normal checkout", () => {
    renderSplit();
    openEqualTab();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" }));
    fireEvent.click(
      screen.getByRole("button", { name: /cashierCheckout\.split\.continueToPayment/ })
    );

    // 30 / 3 → three equal rows, persisted in the cart so a reload keeps them.
    expect(cart().draftTenders.map((t) => t.amount)).toEqual([10, 10, 10]);
    expect(cart().draftTenders.every((t) => t.method === "CASH")).toBe(true);
    expect(screen.getByTestId("equal-checkout")).toBeInTheDocument();
    // It is the plain checkout: no basis, so it prices from the cart and clears it when done.
    expect(parse("equal").basis).toBeUndefined();
  });

  it("closes the split once the sale is done", () => {
    const { onOpenChange } = renderSplit();
    openEqualTab();
    fireEvent.click(
      screen.getByRole("button", { name: /cashierCheckout\.split\.continueToPayment/ })
    );
    // Checkout clears the cart when it succeeds, then the complete screen is dismissed.
    cart().clearCart();
    fireEvent.click(screen.getByText("equal-done"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("equal split is allowed with a coupon or points — it pays the whole cart", () => {
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "ckcoupon0000000000000001",
      code: "SAVE5",
      type: "FIXED",
      value: 5,
      minSubtotal: null,
    });
    renderSplit();
    openEqualTab();
    expect(
      screen.getByRole("button", { name: /cashierCheckout\.split\.continueToPayment/ })
    ).toBeEnabled();
    // 30 − 5 coupon.
    expect(
      within(screen.getByTestId("equal-share").parentElement!).getByRole("button", {
        name: /continueToPayment/,
      })
    ).toHaveTextContent("EUR 25.00");
  });
});
