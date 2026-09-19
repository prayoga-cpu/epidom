import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";

// Radix Switch / RadioGroup measure themselves inside a <form>; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    // The real two-arg formatPrice: a call that forgets the currency would print "undefined 25.00".
    formatPrice: (v: number, currency: string) => `${currency} ${Number(v).toFixed(2)}`,
  }),
}));
vi.mock("@/features/dashboard/profile/hooks/use-finance-settings", () => ({
  useFinanceSettings: () => ({
    data: {
      enabledPaymentMethods: ["CASH", "STRIPE_CARD", "QRIS"],
      payLaterEnabled: true,
      taxLabel: null,
    },
  }),
}));
vi.mock("@/features/dashboard/profile/hooks/use-receipt-settings", () => ({
  useReceiptSettings: () => ({ data: { tagline: "Best ramen" } }),
}));
vi.mock("../../hooks/use-kds-settings", () => ({
  useKdsSettings: () => ({ data: { kitchenDisplayEnabled: true } }),
}));

const display = vi.hoisted(() => ({
  clearCustomerPhone: vi.fn(),
  markCustomerDisplayPaid: vi.fn(),
  phone: null as string | null,
}));
vi.mock("../../hooks/use-customer-display", () => ({
  clearCustomerPhone: display.clearCustomerPhone,
  markCustomerDisplayPaid: display.markCustomerDisplayPaid,
  useCustomerPhone: (select: (s: { phone: string | null; receivedAt: number }) => unknown) =>
    select({ phone: display.phone, receivedAt: 0 }),
}));

const api = vi.hoisted(() => {
  class ApiClientError extends Error {
    constructor(
      public response: { error: { message: string } },
      public status: number
    ) {
      super(response.error.message);
    }
  }
  return { post: vi.fn(), ApiClientError };
});
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: api.post },
  ApiClientError: api.ApiClientError,
}));

const queue = vi.hoisted(() => ({ enqueueOrder: vi.fn() }));
vi.mock("@/lib/pwa/offline-queue", () => queue);

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => analytics);

const { toast } = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast: fn };
});
vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/pwa/thermal-printer", () => ({
  isBluetoothSupported: () => false,
  isPrinterConnected: () => false,
  printReceipt: vi.fn(),
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
}));
vi.mock("../../hooks/use-print-receipt", () => ({
  usePrintReceipt: () => ({ print: vi.fn(), isPrinting: false }),
}));

// The complete screen has its own suite; here it is a probe for what checkout hands it.
const complete = vi.hoisted(() => ({ props: [] as any[] }));
vi.mock("../pos-order-complete-dialog", () => ({
  PosOrderCompleteDialog: (props: any) => {
    complete.props.push(props);
    return <div data-testid="complete-dialog" />;
  },
}));

import { PosCheckoutDialog, type CheckoutBasis } from "../pos-checkout-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";
import { useLastReceipt } from "../../hooks/use-last-receipt";
import type { CartCustomer } from "../../types/pos.types";

const RAMEN = "ckramen000000000000000001";
const SHIFT = "ckshift00000000000000001";
const CUSTOMER_ID = "ckcust0000000000000000001";
const PRESET_ID = "ckpreset00000000000000001";

const alice: CartCustomer = {
  id: CUSTOMER_ID,
  name: "Alice",
  phone: "+33612345678",
  email: "alice@example.com",
  points: 300,
  lifetimeSpend: 500,
};

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
  cart().addItem(RAMEN, "Ramen", 12.5, 2); // 25.00
}

const lastComplete = () => complete.props[complete.props.length - 1];
const setOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });

function renderCheckout(props: Partial<ComponentProps<typeof PosCheckoutDialog>> = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <PosCheckoutDialog
      open
      onOpenChange={onOpenChange}
      storeId="store-1"
      storeName="Cafe"
      cashierName="Sam"
      shiftId={SHIFT}
      {...props}
    />
  );
  return { onOpenChange, ...utils };
}

const confirmButton = () => screen.getByRole("button", { name: /pos\.checkout\.confirm/ });
const chooseMethod = (label: string) => fireEvent.click(screen.getByRole("radio", { name: label }));
const typeCash = (value: string) =>
  fireEvent.change(screen.getByLabelText("pos.checkout.amountTendered"), { target: { value } });

/** Confirms, then waits until the sale either finished (complete screen shown) or failed (error toast). */
async function submit() {
  fireEvent.click(confirmButton());
  await waitFor(() =>
    expect(complete.props.length + toast.error.mock.calls.length).toBeGreaterThan(0)
  );
}

beforeEach(() => {
  localStorage.clear();
  seedCart();
  complete.props = [];
  display.phone = null;
  api.post.mockResolvedValue({ orderId: "order-1", orderNumber: "#101" });
  queue.enqueueOrder.mockResolvedValue("abcdef12-0000-4000-8000-000000000000");
  setOnline(true);
  useLastReceipt.getState().clear();
});
afterEach(() => setOnline(true));

describe("PosCheckoutDialog — what the cart now owns", () => {
  it("reads order type, pax, table and customer back as one summary line, with no fields to edit them", () => {
    cart().setOrderType("DINE_IN");
    cart().setGuestCount(3);
    cart().setTableNumber("A1");
    cart().setCustomer(alice);
    renderCheckout();

    expect(screen.getByTestId("checkout-summary")).toHaveTextContent(
      "pos.checkout.dineIn · cashierCheckout.summary.pax · pos.checkout.table A1 · Alice"
    );
    // The old order-type radio, pax stepper, customer and table fields are gone.
    expect(screen.queryByText("pos.checkout.orderType")).toBeNull();
    expect(screen.queryByText("pos.checkout.guestCount")).toBeNull();
    expect(screen.queryByText("pos.checkout.customerName")).toBeNull();
    expect(screen.queryByText("pos.checkout.tableOptional")).toBeNull();
    // Notes, payment method and the stock hint stay.
    expect(screen.getByText("pos.checkout.notes")).toBeInTheDocument();
    expect(screen.getByText("pos.checkout.paymentMethod")).toBeInTheDocument();
    expect(screen.getByText("pos.checkout.stockDeductedOnDelivery")).toBeInTheDocument();
  });

  it("takeaway shows no pax", () => {
    cart().setOrderType("TAKEAWAY");
    renderCheckout();
    expect(screen.getByTestId("checkout-summary")).toHaveTextContent("pos.checkout.takeaway");
    expect(screen.getByTestId("checkout-summary")).not.toHaveTextContent("summary.pax");
  });

  it("shows the total in the store's currency (two-arg formatPrice)", () => {
    renderCheckout();
    expect(screen.getAllByText("EUR 25.00").length).toBeGreaterThan(0);
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

describe("PosCheckoutDialog — cash templates", () => {
  it("renders the presets under the field and tapping one fills the amount tendered", () => {
    renderCheckout();
    const group = screen.getByRole("group", { name: "cashierCheckout.cash.quickAmounts" });
    const buttons = within(group).getAllByRole("button");
    // EUR 25.00 → exact, then 30 / 40 / 50 / 100.
    expect(buttons.map((b) => b.textContent)).toEqual([
      "cashierCheckout.cash.exactEUR 25.00",
      "EUR 30.00",
      "EUR 40.00",
      "EUR 50.00",
      "EUR 100.00",
    ]);

    // Nothing entered yet → can't confirm.
    expect(confirmButton()).toBeDisabled();

    fireEvent.click(within(group).getByRole("button", { name: "EUR 30.00" }));
    expect(screen.getByLabelText("pos.checkout.amountTendered")).toHaveValue("30");
    expect(confirmButton()).toBeEnabled();
    // Change is worked out from it.
    expect(screen.getByText("EUR 5.00")).toBeInTheDocument();
  });

  it("Exact fills the total", () => {
    renderCheckout();
    fireEvent.click(
      within(screen.getByRole("group", { name: "cashierCheckout.cash.quickAmounts" })).getAllByRole(
        "button"
      )[0]
    );
    expect(screen.getByLabelText("pos.checkout.amountTendered")).toHaveValue("25");
    expect(confirmButton()).toBeEnabled();
  });

  it("an amount under the total blocks confirming", () => {
    renderCheckout();
    typeCash("10");
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText("pos.checkout.insufficientAmount")).toBeInTheDocument();
  });
});

describe("PosCheckoutDialog — single-method sale keeps the exact legacy payload", () => {
  it("cash: posts today's fields and nothing new", async () => {
    renderCheckout();
    typeCash("30");
    await submit();

    expect(api.post).toHaveBeenCalledTimes(1);
    const [endpoint, body] = api.post.mock.calls[0];
    expect(endpoint).toBe("/stores/store-1/pos/orders");
    expect(body).toStrictEqual({
      items: [
        { menuItemId: RAMEN, name: "Ramen", quantity: 2, unitPrice: 12.5, selectedOptions: [] },
      ],
      orderType: "DINE_IN",
      guestCount: 1,
      shiftId: SHIFT,
      paymentMethod: "CASH",
      amountTendered: 30,
    });
    expect(queue.enqueueOrder).not.toHaveBeenCalled();
  });

  it("cash sale finishes the way it always did: cart cleared, display told, receipt remembered", async () => {
    const { onOpenChange } = renderCheckout();
    typeCash("30");
    await submit();

    expect(cart().items).toHaveLength(0);
    expect(display.markCustomerDisplayPaid).toHaveBeenCalledWith("#101", 25);
    expect(display.clearCustomerPhone).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      "purchase",
      expect.objectContaining({ transaction_id: "#101", value: 25, currency: "EUR" })
    );
    expect(toast.success).toHaveBeenCalledWith("pos.checkout.success");
    expect(useLastReceipt.getState().receipt?.orderNumber).toBe("#101");
    expect(useLastReceipt.getState().meta).toMatchObject({ orderId: "order-1" });
  });

  it("hands the complete screen the change and the payment summary", async () => {
    renderCheckout();
    typeCash("30");
    await submit();

    const { result, storeId } = lastComplete();
    expect(storeId).toBe("store-1");
    expect(result).toMatchObject({
      orderId: "order-1",
      orderNumber: "#101",
      total: 25,
      change: 5,
      paid: true,
      paymentSummary: "publicOrder.paymentMethods.CASH",
    });
    expect(result.receipt).toMatchObject({
      storeName: "Cafe",
      currency: "EUR",
      total: 25,
      paymentMethod: "CASH",
      amountTendered: 30,
      change: 5,
      cashierName: "Sam",
    });
    expect(result.receipt.payments).toBeUndefined();
  });

  it("the server's figures win over a client recompute (re-priced discount, its own change and tenders)", async () => {
    api.post.mockResolvedValueOnce({
      orderId: "order-1",
      orderNumber: "#101",
      total: 22.5,
      discountAmount: 2.5,
      change: 7.5,
      paymentStatus: "PAID",
      payments: [{ method: "CASH", amount: 22.5, amountTendered: 30, change: 7.5, note: null }],
    });
    renderCheckout();
    typeCash("30");
    await submit();

    const { result } = lastComplete();
    expect(result.total).toBe(22.5);
    expect(result.change).toBe(7.5);
    expect(result.receipt).toMatchObject({ total: 22.5, discountAmount: 2.5, change: 7.5 });
    expect(display.markCustomerDisplayPaid).toHaveBeenCalledWith("#101", 22.5);
  });

  it("QRIS sends no cash fields, and no change is shown", async () => {
    renderCheckout();
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();
    expect(api.post.mock.calls[0][1]).toStrictEqual({
      items: [
        { menuItemId: RAMEN, name: "Ramen", quantity: 2, unitPrice: 12.5, selectedOptions: [] },
      ],
      orderType: "DINE_IN",
      guestCount: 1,
      shiftId: SHIFT,
      paymentMethod: "QRIS",
    });
    expect(lastComplete().result.change).toBeNull();
  });

  it("Other needs a label, and sends it as paymentNote", async () => {
    renderCheckout();
    chooseMethod("pos.checkout.other");
    fireEvent.click(confirmButton());
    // Blocked client-side with the localized message; nothing is posted.
    expect(await screen.findByText("pos.checkout.customPaymentMethodRequired")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("pos.checkout.customPaymentMethodPlaceholder"), {
      target: { value: "Crypto" },
    });
    await submit();
    expect(api.post.mock.calls[0][1]).toMatchObject({
      paymentMethod: "OTHER",
      paymentNote: "Crypto",
    });
  });

  it("Pay Later is placed, not paid", async () => {
    api.post.mockResolvedValueOnce({
      orderId: "order-2",
      orderNumber: "#102",
      paymentStatus: "PENDING",
    });
    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: "pos.checkout.payLater" }));
    await submit();
    expect(api.post.mock.calls[0][1]).toMatchObject({ paymentMethod: "PAY_LATER" });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty("amountTendered");
    expect(lastComplete().result.paid).toBe(false);
  });

  it("a resumed Saved bill is finalized, not created again", async () => {
    cart().setResumingOrderId("order-9");
    renderCheckout();
    typeCash("25");
    await submit();
    expect(api.post.mock.calls[0][0]).toBe("/stores/store-1/pos/orders/order-9/finalize");
  });

  it("surfaces the server's own reason and leaves the sale untouched", async () => {
    api.post.mockRejectedValueOnce(
      new api.ApiClientError({ error: { message: "Cash tendered is less than the total" } }, 422)
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderCheckout();
    typeCash("30");
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Cash tendered is less than the total")
    );
    expect(cart().items).toHaveLength(1);
    expect(complete.props).toHaveLength(0);
    expect(display.markCustomerDisplayPaid).not.toHaveBeenCalled();
  });

  it("a fresh sale doesn't inherit the last one's tendered amount", () => {
    const { rerender, onOpenChange } = renderCheckout();
    typeCash("30");
    expect(screen.getByLabelText("pos.checkout.amountTendered")).toHaveValue("30");
    rerender(<PosCheckoutDialog open={false} onOpenChange={onOpenChange} storeId="store-1" />);
    rerender(<PosCheckoutDialog open onOpenChange={onOpenChange} storeId="store-1" />);
    expect(screen.getByLabelText("pos.checkout.amountTendered")).toHaveValue("");
  });
});

describe("PosCheckoutDialog — cart-owned extras in the payload", () => {
  it("sends order type, table, customer and the preset id (never a computed amount for it)", async () => {
    cart().setOrderType("DINE_IN");
    cart().setGuestCount(4);
    cart().setTableNumber("B2");
    cart().setCustomer(alice);
    cart().setDiscountSource({
      kind: "preset",
      presetId: PRESET_ID,
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    renderCheckout();
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();

    const body = api.post.mock.calls[0][1];
    expect(body).toMatchObject({
      orderType: "DINE_IN",
      guestCount: 4,
      tableNumber: "B2",
      customerId: CUSTOMER_ID,
      customerName: "Alice",
      customerPhone: "+33612345678",
      presetId: PRESET_ID,
    });
    expect(body).not.toHaveProperty("discountAmount");
    expect(body).not.toHaveProperty("discountReason");
  });

  it("a number typed on the customer display is the phone when there is no customer", async () => {
    display.phone = "+6281234567890";
    renderCheckout();
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();
    expect(api.post.mock.calls[0][1]).toMatchObject({ customerPhone: "+6281234567890" });
    expect(lastComplete().result.customer).toEqual({
      name: null,
      phone: "+6281234567890",
      email: null,
    });
  });

  it("prefills the complete screen's send fields from the attached customer", async () => {
    cart().setCustomer(alice);
    renderCheckout();
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();
    expect(lastComplete().result.customer).toEqual({
      name: "Alice",
      phone: "+33612345678",
      email: "alice@example.com",
    });
  });
});

describe("PosCheckoutDialog — split payment", () => {
  const openSplit = () => fireEvent.click(screen.getByRole("switch"));

  it("the toggle swaps the payment area for the tender list and seeds two persisted rows", () => {
    renderCheckout();
    expect(screen.queryAllByTestId("tender-row")).toHaveLength(0);
    openSplit();
    expect(screen.getAllByTestId("tender-row")).toHaveLength(2);
    expect(screen.queryByText("pos.checkout.paymentMethod")).toBeNull();
    // Rows live in the cart store, so a reload keeps them.
    expect(cart().draftTenders).toHaveLength(2);
    // Pay Later can't be part of a split.
    expect(screen.queryByRole("button", { name: "pos.checkout.payLater" })).toBeNull();
  });

  it("can't be confirmed until Remaining reaches zero", () => {
    renderCheckout();
    openSplit();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    expect(confirmButton()).toBeEnabled();
    // Overpaying blocks it again.
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.amount 1"), {
      target: { value: "20" },
    });
    expect(confirmButton()).toBeDisabled();
  });

  it("posts payments[] with no legacy payment fields", async () => {
    renderCheckout();
    openSplit();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.cashReceived 1"), {
      target: { value: "20" },
    });
    await submit();

    expect(api.post.mock.calls[0][1]).toStrictEqual({
      items: [
        { menuItemId: RAMEN, name: "Ramen", quantity: 2, unitPrice: 12.5, selectedOptions: [] },
      ],
      orderType: "DINE_IN",
      guestCount: 1,
      shiftId: SHIFT,
      payments: [
        { method: "CASH", amount: 12.5, amountTendered: 20 },
        { method: "STRIPE_CARD", amount: 12.5 },
      ],
    });
  });

  it("the complete screen gets the split's change and a per-tender summary; the receipt lists each tender", async () => {
    renderCheckout();
    openSplit();
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.cashReceived 1"), {
      target: { value: "20" },
    });
    await submit();

    const { result } = lastComplete();
    expect(result.change).toBe(7.5);
    expect(result.paymentSummary).toBe(
      "publicOrder.paymentMethods.CASH EUR 12.50 · pos.markPaid.creditCard EUR 12.50"
    );
    expect(result.receipt.paymentMethod).toBe("SPLIT");
    expect(result.receipt.payments).toEqual([
      { method: "CASH", amount: 12.5, amountTendered: 20, change: 7.5 },
      { method: "STRIPE_CARD", amount: 12.5 },
    ]);
    // Finishing clears the persisted rows along with the cart.
    expect(cart().draftTenders).toEqual([]);
  });

  it("reopens straight into split mode when draft rows are waiting (the equal-split flow)", () => {
    cart().setDraftTenders([
      { id: "a", method: "CASH", amount: 12.5, amountTendered: null, note: "" },
      { id: "b", method: "QRIS", amount: 12.5, amountTendered: null, note: "" },
    ]);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <PosCheckoutDialog open={false} onOpenChange={onOpenChange} storeId="store-1" />
    );
    rerender(<PosCheckoutDialog open onOpenChange={onOpenChange} storeId="store-1" />);
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getAllByTestId("tender-row")).toHaveLength(2);
    expect(confirmButton()).toBeEnabled();
  });

  it("switching split off discards the rows", () => {
    renderCheckout();
    openSplit();
    openSplit();
    expect(cart().draftTenders).toEqual([]);
    expect(screen.getByText("pos.checkout.paymentMethod")).toBeInTheDocument();
  });
});

describe("PosCheckoutDialog — offline", () => {
  const withEverything = () => {
    cart().setOrderType("DINE_IN");
    cart().setGuestCount(2);
    cart().setTableNumber("A1");
    cart().setCustomer(alice);
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "ckcoupon0000000000000001",
      code: "SAVE5",
      type: "FIXED",
      value: 5,
      minSubtotal: null,
    });
    cart().setLoyaltyRules({
      enabled: true,
      spendPerPoint: 10,
      pointValue: 0.5,
      minRedeemPoints: 0,
    });
    cart().setRedeemPoints(4);
  };

  it("queues a downgraded legacy payload: flat discount, free-text customer, no server-validated extras", async () => {
    setOnline(false);
    withEverything();
    const previewed = { amount: cart().discountAmount, reason: cart().discountReason };
    // Coupon (5) plus points folded together.
    expect(previewed.amount).toBeGreaterThan(5);

    renderCheckout();
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();

    expect(api.post).not.toHaveBeenCalled();
    expect(queue.enqueueOrder).toHaveBeenCalledTimes(1);
    const [storeId, body] = queue.enqueueOrder.mock.calls[0];
    expect(storeId).toBe("store-1");
    expect(body).toStrictEqual({
      items: [
        { menuItemId: RAMEN, name: "Ramen", quantity: 2, unitPrice: 12.5, selectedOptions: [] },
      ],
      orderType: "DINE_IN",
      guestCount: 2,
      tableNumber: "A1",
      customerName: "Alice",
      customerPhone: "+33612345678",
      discountAmount: previewed.amount,
      discountReason: previewed.reason,
      paymentMethod: "QRIS",
    });
    for (const dropped of [
      "customerId",
      "presetId",
      "couponCode",
      "redeemPoints",
      "shiftId",
      "payments",
    ]) {
      expect(body).not.toHaveProperty(dropped);
    }
  });

  it("still finishes the sale: local order number, no order id, cart cleared", async () => {
    setOnline(false);
    renderCheckout();
    typeCash("25");
    await submit();

    const { result } = lastComplete();
    expect(result.orderId).toBeNull();
    expect(result.orderNumber).toBe("OFFLINE-ABCDEF12");
    expect(cart().items).toHaveLength(0);
    // No server id → no last-receipt meta (nothing to send yet).
    expect(useLastReceipt.getState().meta).toBeNull();
    expect(toast).toHaveBeenCalledWith("pos.offline.queued", expect.anything());
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it("a resumed Saved bill can't be queued", async () => {
    setOnline(false);
    cart().setResumingOrderId("order-9");
    renderCheckout();
    typeCash("25");
    fireEvent.click(confirmButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("pos.cart.holdOffline"));
    expect(queue.enqueueOrder).not.toHaveBeenCalled();
    expect(cart().items).toHaveLength(1);
  });

  it("a split payment queues as payments[]", async () => {
    setOnline(false);
    renderCheckout();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    await submit();
    expect(queue.enqueueOrder.mock.calls[0][1]).toMatchObject({
      payments: [
        { method: "CASH", amount: 12.5 },
        { method: "STRIPE_CARD", amount: 12.5 },
      ],
    });
  });
});

describe("PosCheckoutDialog — one bill of a split by items (basis)", () => {
  const basis = (over: Partial<CheckoutBasis> = {}): CheckoutBasis => {
    const line = cart().items[0];
    return {
      items: [{ ...line, quantity: 1, lineTotal: 12.5 }],
      subtotal: 11.25,
      tax: 0,
      serviceCharge: 0,
      discountAmount: 1.25,
      discountReason: "Member",
      total: 11.25,
      splitGroupId: "grp12345",
      guestCount: 2,
      ...over,
    };
  };

  it("prices and sends from the basis, tagged with the split group and Bill 1's pax", async () => {
    cart().setGuestCount(4);
    const onPaid = vi.fn();
    renderCheckout({ basis: basis(), onPaid, title: "Bill 1" });
    expect(screen.getByText("Bill 1")).toBeInTheDocument();
    expect(screen.getAllByText("EUR 11.25").length).toBeGreaterThan(0);

    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();

    expect(api.post.mock.calls[0][0]).toBe("/stores/store-1/pos/orders");
    expect(api.post.mock.calls[0][1]).toStrictEqual({
      items: [
        { menuItemId: RAMEN, name: "Ramen", quantity: 1, unitPrice: 12.5, selectedOptions: [] },
      ],
      orderType: "DINE_IN",
      guestCount: 2,
      // A bill's discount is its own flat share — never a preset for the server to re-price.
      discountAmount: 1.25,
      discountReason: "Member",
      splitGroupId: "grp12345",
      shiftId: SHIFT,
      paymentMethod: "QRIS",
    });
  });

  it("does not clear the cart or the customer display, and reports the bill paid", async () => {
    const onPaid = vi.fn();
    renderCheckout({ basis: basis(), onPaid });
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(cart().items).toHaveLength(1);
    expect(cart().items[0].quantity).toBe(2);
    expect(display.markCustomerDisplayPaid).not.toHaveBeenCalled();
    expect(display.clearCustomerPhone).not.toHaveBeenCalled();
    // Each bill is still a purchase.
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      "purchase",
      expect.objectContaining({ value: 11.25 })
    );
  });

  it("only Bill 1 carries pax; a later bill sends none", async () => {
    renderCheckout({ basis: basis({ guestCount: null }) });
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();
    expect(api.post.mock.calls[0][1]).not.toHaveProperty("guestCount");
  });

  it("never finalizes a resumed Saved bill for one bill's worth of lines", async () => {
    cart().setResumingOrderId("order-9");
    renderCheckout({ basis: basis() });
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();
    expect(api.post.mock.calls[0][0]).toBe("/stores/store-1/pos/orders");
  });

  it("the complete screen says 'Next bill' while lines remain, and dismissing it reports done", async () => {
    const onDone = vi.fn();
    renderCheckout({ basis: basis(), onDone });
    chooseMethod("publicOrder.paymentMethods.QRIS");
    await submit();

    expect(lastComplete().newSaleLabel).toBe("cashierCheckout.complete.nextBill");
    lastComplete().onNewSale();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a bill's split payment rows are its own — they don't touch the cart's draft rows", () => {
    renderCheckout({ basis: basis() });
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getAllByTestId("tender-row")).toHaveLength(2);
    expect(cart().draftTenders).toEqual([]);
  });
});

describe("PosCheckoutDialog — a bill discounted to nothing", () => {
  it("skips the payment area and lets the cashier confirm; no tender is required", async () => {
    cart().setDiscount(25, "Comp");
    expect(cart().total).toBe(0);
    renderCheckout();

    expect(screen.getByText("cashierCheckout.freeOrder.title")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("pos.checkout.paymentMethod")).toBeNull();
    expect(screen.queryByLabelText("pos.checkout.amountTendered")).toBeNull();
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const body = api.post.mock.calls[0][1];
    expect(body).toMatchObject({
      paymentMethod: "CASH",
      discountAmount: 25,
      discountReason: "Comp",
    });
    expect(body).not.toHaveProperty("amountTendered");
    await waitFor(() => expect(complete.props.length).toBeGreaterThan(0));
    expect(lastComplete().result).toMatchObject({
      total: 0,
      change: null,
      paymentSummary: "cashierCheckout.complete.noPaymentDue",
    });
  });
});
