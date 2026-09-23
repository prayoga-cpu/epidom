import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createQueryWrapper, stubBrowserApis } from "./cart-test-utils";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const currencyMock = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  currencyMock.value = makeCurrencyMock("EUR");
  return { useCurrency: () => currencyMock.value };
});

const env = vi.hoisted(() => ({
  online: true,
  plan: "OPERATIONS" as string,
  requireFeature: vi.fn(),
  kdsEnabled: true,
  finance: undefined as unknown,
  orders: [] as unknown[],
  loyalty: undefined as unknown,
  print: vi.fn(),
}));

vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => env.online }));
vi.mock("@/features/pos-mode/pos-mode-upgrade-banner", () => ({
  usePosModeUpgradeGate: () => ({ currentPlan: env.plan, requireFeature: env.requireFeature }),
}));
vi.mock("../../hooks/use-pos-session", () => ({
  usePosSession: () => ({ staffName: "Léa", shiftId: "shift_1" }),
}));
vi.mock("../../hooks/use-kds-settings", () => ({
  useKdsSettings: () => ({ data: { kitchenDisplayEnabled: env.kdsEnabled } }),
}));
vi.mock("@/features/dashboard/profile/hooks/use-finance-settings", () => ({
  useFinanceSettings: () => ({ data: env.finance }),
}));
vi.mock("@/features/dashboard/profile/hooks/use-receipt-settings", () => ({
  useReceiptSettings: () => ({ data: { tagline: "Always fresh", showSocialLinks: true } }),
}));
vi.mock("../../hooks/use-pos-menu", () => ({
  usePosMenu: () => ({ data: { categories: [] } }),
}));
vi.mock("../../hooks/use-pos-orders-snapshot", () => ({
  usePosOrdersSnapshot: () => ({ data: env.orders, isLoading: false }),
}));
const loyaltyHook = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/use-loyalty-settings", () => ({ useLoyaltySettings: loyaltyHook }));
vi.mock("../../hooks/use-discount-presets", () => ({
  useDiscountPresets: () => ({ data: [] }),
}));
vi.mock("../../hooks/use-print-receipt", () => ({
  usePrintReceipt: () => ({ print: env.print, isPrinting: false }),
}));
vi.mock("../../hooks/use-printer-settings", () => ({
  usePrinterSettings: (selector: (s: { printers: { MAIN: { paperWidth: 32 | 48 } } }) => unknown) =>
    selector({ printers: { MAIN: { paperWidth: 32 } } }),
}));

// The two heavyweight siblings owned by the checkout side: only their props matter here.
const checkoutProps = vi.hoisted(() => ({ last: null as any }));
vi.mock("../pos-checkout-dialog", () => ({
  PosCheckoutDialog: (props: any) => {
    checkoutProps.last = props;
    return props.open ? <div data-testid="checkout-dialog" /> : null;
  },
}));
vi.mock("../pos-split-bill-dialog", () => ({
  PosSplitBillDialog: (props: any) => (props.open ? <div data-testid="split-dialog" /> : null),
}));
vi.mock("@/components/shared/menu-item-options-dialog", () => ({
  MenuItemOptionsDialog: () => null,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { planAtLeast, type PlanTier } from "@/lib/plans/entitlements";
import { PosCart } from "../pos-cart";
import { usePosCart } from "../../hooks/use-pos-cart";
import { useLastReceipt } from "../../hooks/use-last-receipt";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const cart = () => usePosCart.getState();

const finance = (over: Record<string, unknown> = {}) => ({
  taxEnabled: false,
  taxRate: 0,
  taxLabel: null,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  ...over,
});

const lastReceipt: ReceiptData = {
  storeName: "Café",
  orderNumber: "POS-LAST",
  date: "19/09/2026",
  items: [],
  subtotal: 10,
  total: 10,
  paymentMethod: "CASH",
};

function renderCart(props: Partial<React.ComponentProps<typeof PosCart>> = {}) {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <PosCart storeId="s1" storeName="Café Rivoli" {...props} />
    </Wrapper>
  );
}

const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  cart().setLoyaltyRules(null);
  cart().setFinanceSettings({
    taxEnabled: false,
    taxRate: 0,
    taxInclusive: true,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    processingFeeEnabled: false,
    processingFeeOverrides: null,
  });
  useLastReceipt.setState({ receipt: null, meta: null });
  env.online = true;
  env.plan = "OPERATIONS";
  env.kdsEnabled = true;
  env.finance = finance();
  env.orders = [];
  env.print.mockReset();
  env.print.mockResolvedValue(undefined);
  env.requireFeature.mockReset();
  env.requireFeature.mockImplementation((min: PlanTier) => planAtLeast(env.plan as PlanTier, min));
  loyaltyHook.mockReset();
  loyaltyHook.mockReturnValue({ data: undefined });
  get.mockReset();
  get.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 } as any);
  post.mockReset();
  checkoutProps.last = null;
});

// ── Layout ───────────────────────────────────────────────────────────────────

describe("PosCart — the empty panel", () => {
  it("still shows the header, so Order Queue and Dine In | Take Away work before the first item", () => {
    renderCart();
    expect(screen.getByRole("link", { name: /Order Queue/ }).getAttribute("href")).toBe(
      "/store/s1/pos/orders"
    );
    expect(screen.getByRole("radio", { name: "Dine In" })).toBeTruthy();
    expect(screen.getByText("pos.cart.empty")).toBeTruthy();
  });

  it("disables Save Bill, Print Bill and Charge until there is something to bill", () => {
    renderCart();
    expect(button("cashierCart.footer.saveBill").disabled).toBe(true);
    expect(button("cashierCart.footer.printBill").disabled).toBe(true);
    expect(button(/Charge/).disabled).toBe(true);
    expect(screen.queryByTestId("pos-cart-totals")).toBeNull();
  });

  it("keeps the customer row and More available on an empty cart", () => {
    renderCart();
    expect(screen.getByRole("button", { name: /Add Customer/ })).toBeTruthy();
    expect(button("cashierCart.actions.more").disabled).toBe(false);
  });
});

describe("PosCart — flex chain and footer (the tablet invariants)", () => {
  it("keeps the flex-1 min-h-0 root, the min-h-0 flex-1 overflow-y-auto scroller and the shrink-0 shadowed footer", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    const { container } = renderCart();

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-0");
    expect(root.className).toContain("flex-1");
    expect(root.className).toContain("flex-col");

    const scroller = root.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller.className).toContain("min-h-0");
    expect(scroller.className).toContain("flex-1");

    const footer = screen.getByTestId("pos-cart-totals").closest(".shrink-0") as HTMLElement;
    expect(footer.className).toContain("shrink-0");
    expect(footer.className).toContain("shadow-[0_-6px_10px_-6px_rgba(0,0,0,0.15)]");
    expect(footer.className).toContain("bg-background");
  });

  it("no button in a row with siblings uses w-full (it would overflow by the sibling's width)", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    for (const name of [
      "cashierCart.footer.saveBill",
      "cashierCart.footer.printBill",
      /Charge/,
      "cashierCart.actions.more",
    ]) {
      expect(button(name).className).not.toContain("w-full");
    }
    // Save Bill, Print Bill and Charge share their rows' free space; the square
    // More button beside Charge keeps its own fixed size instead.
    for (const name of ["cashierCart.footer.saveBill", "cashierCart.footer.printBill", /Charge/]) {
      expect(button(name).className).toContain("flex-1");
    }
    expect(button("cashierCart.actions.more").className).toContain("shrink-0");
  });

  it("gives every footer control a >=44px tap target", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    for (const name of ["cashierCart.footer.saveBill", "cashierCart.footer.printBill"]) {
      expect(button(name).className).toContain("h-11");
    }
    expect(button(/Charge/).className).toContain("min-h-12");
    // More is icon-only and square, the same 48px as Charge's floor.
    expect(button("cashierCart.actions.more").className).toContain("size-12");
  });

  it("puts More, icon-only, on the right of Charge — Discount and Reprint Last are no longer on the surface", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    const charge = button(/Charge/);
    const more = button("cashierCart.actions.more");
    // Same row, More after Charge.
    expect(more.parentElement).toBe(charge.parentElement);
    expect(charge.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No visible title on it — just the icon (the name lives in aria-label). A
    // burger, not the ⋯ dots the POS tab bar's own More already uses.
    expect(more.textContent).toBe("");
    expect(more.querySelector("svg.lucide-menu")).toBeTruthy();
    expect(more.querySelector("svg.lucide-ellipsis")).toBeNull();
    expect(screen.queryByRole("button", { name: "cashierCart.actions.discount" })).toBeNull();
    expect(screen.queryByRole("button", { name: "cashierCart.actions.reprintLast" })).toBeNull();
  });

  it("puts the customer row inside the scroller so an expanded picker can't squeeze the footer off screen", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    const { container } = renderCart();
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(within(scroller).getByTestId("pos-cart-customer")).toBeTruthy();
  });

  it("the mobile dialog's close X is only rendered when onClose is passed", () => {
    const { unmount } = renderCart();
    expect(screen.queryByRole("button", { name: "common.actions.close" })).toBeNull();
    unmount();
    renderCart({ onClose: vi.fn() });
    expect(screen.getByRole("button", { name: "common.actions.close" })).toBeTruthy();
  });
});

// ── The live bill ────────────────────────────────────────────────────────────

describe("PosCart — the live bill", () => {
  it("lays lines out like a receipt with the total in the store's currency", () => {
    cart().addItem("m1", "Ramen", 12.5, 2);
    renderCart();
    expect(screen.getByText("2×")).toBeTruthy();
    expect(screen.getByText("Ramen")).toBeTruthy();
    expect(screen.getAllByText("EUR 25.00").length).toBeGreaterThan(0);
    for (const call of currencyMock.value.formatPrice.mock.calls) expect(call[1]).toBe("EUR");
  });

  it("marks a Custom Item as custom", () => {
    cart().addCustomItem({ name: "Delivery fee", unitPrice: 4, quantity: 1, department: "BAR" });
    renderCart();
    expect(screen.getByText("Delivery fee")).toBeTruthy();
    expect(screen.getByText(/cashierCart\.item\.custom/)).toBeTruthy();
  });

  it("feeds the store's tax and service-charge rates into the bill labels", () => {
    env.finance = finance({ taxEnabled: true, taxRate: 0.1, taxInclusive: true, taxLabel: "TVA" });
    cart().addItem("m1", "Ramen", 110, 1);
    renderCart();
    expect(screen.getByText("TVA (10%) included")).toBeTruthy();
  });

  it("shows the resumed-bill banner when the cart holds a saved bill", () => {
    cart().hydrateFromOrder(
      [
        {
          id: "l1",
          menuItemId: "m1",
          name: "Ramen",
          unitPrice: 10,
          quantity: 1,
          modifiers: [],
          lineTotal: 10,
        },
      ],
      "order_1"
    );
    renderCart();
    expect(screen.getByText("pos.orderCard.resumedBanner")).toBeTruthy();
  });

  it("Charge shows the total and opens checkout on the desktop pane", () => {
    cart().addItem("m1", "Ramen", 12.5, 2);
    renderCart();
    expect(button(/Charge/).textContent).toContain("EUR 25.00");
    expect(screen.queryByTestId("checkout-dialog")).toBeNull();
    fireEvent.click(button(/Charge/));
    expect(screen.getByTestId("checkout-dialog")).toBeTruthy();
    expect(checkoutProps.last).toMatchObject({
      storeId: "s1",
      storeName: "Café Rivoli",
      cashierName: "Léa",
      shiftId: "shift_1",
    });
  });

  it("on mobile, Charge hands off to onRequestCheckout instead of opening a dialog of its own", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    const onRequestCheckout = vi.fn();
    renderCart({ onRequestCheckout });
    fireEvent.click(button(/Charge/));
    expect(onRequestCheckout).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("checkout-dialog")).toBeNull();
  });
});

// ── Load-bearing effects ─────────────────────────────────────────────────────

describe("PosCart — keeping the cart's rules in sync", () => {
  it("syncs the store's finance settings into the cart", () => {
    env.finance = finance({ taxEnabled: true, taxRate: 0.2, taxInclusive: false });
    renderCart();
    expect(cart().financeSettings).toMatchObject({
      taxEnabled: true,
      taxRate: 0.2,
      taxInclusive: false,
    });
  });

  it("feeds fetched loyalty rules into the cart", () => {
    const rules = { enabled: true, spendPerPoint: 10, pointValue: 0.5, minRedeemPoints: 5 };
    loyaltyHook.mockReturnValue({ data: rules });
    renderCart();
    expect(cart().loyaltyRules).toEqual(rules);
  });

  it("only fetches loyalty where the plan allows and the till is online (no 403 noise)", () => {
    renderCart();
    expect(loyaltyHook).toHaveBeenLastCalledWith("s1", true);
  });

  it("below the plan it does not fetch loyalty at all", () => {
    env.plan = "POS";
    renderCart();
    expect(loyaltyHook).toHaveBeenLastCalledWith("s1", false);
  });

  it("offline it does not fetch loyalty, and keeps the persisted rules instead of wiping them", () => {
    const rules = { enabled: true, spendPerPoint: 10, pointValue: 0.5, minRedeemPoints: 0 };
    cart().setLoyaltyRules(rules);
    env.online = false;
    renderCart();
    expect(loyaltyHook).toHaveBeenLastCalledWith("s1", false);
    expect(cart().loyaltyRules).toEqual(rules);
  });
});

// ── More ─────────────────────────────────────────────────────────────────────
// Discount and Reprint Last used to have quick-row buttons of their own; they now
// live only in the More sheet, which the square ⋯ button beside Charge opens.

/** A tile in the open More sheet. */
const moreTile = (action: string) =>
  document.querySelector(`button[data-action="${action}"]`) as HTMLButtonElement;

describe("PosCart — More", () => {
  it("Discount, from More, opens the discount dialog at the plan", () => {
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    fireEvent.click(moreTile("discount"));
    expect(env.requireFeature).toHaveBeenCalledWith("OPERATIONS", expect.any(String));
    expect(screen.getByRole("heading", { name: "cashierCart.discountDialog.title" })).toBeTruthy();
  });

  it("Discount below the plan raises the upgrade banner instead of the dialog", () => {
    env.plan = "POS";
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    fireEvent.click(moreTile("discount"));
    expect(env.requireFeature).toHaveReturnedWith(false);
    expect(screen.queryByRole("heading", { name: "cashierCart.discountDialog.title" })).toBeNull();
  });

  it("Discount is disabled in More while the bill is empty", () => {
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    expect(moreTile("discount").disabled).toBe(true);
  });

  it("Reprint Last is disabled in More until a sale has been completed on this device", () => {
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    expect(moreTile("reprintLast").disabled).toBe(true);
  });

  it("Reprint Last, from More, prints the last receipt", async () => {
    useLastReceipt.setState({ receipt: lastReceipt, meta: null });
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    fireEvent.click(moreTile("reprintLast"));
    await waitFor(() => expect(env.print).toHaveBeenCalledWith(lastReceipt));
  });

  it("More opens the sheet, and Custom Item from it opens the Custom Item dialog", () => {
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    expect(screen.getByRole("heading", { name: "More" })).toBeTruthy();
    fireEvent.click(document.querySelector('button[data-action="customItem"]') as HTMLElement);
    expect(screen.getByRole("heading", { name: "cashierCart.customItem.title" })).toBeTruthy();
  });

  it("a custom item added from the dialog lands on the bill", async () => {
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    fireEvent.click(document.querySelector('button[data-action="customItem"]') as HTMLElement);
    fireEvent.change(screen.getByLabelText("cashierCart.customItem.description"), {
      target: { value: "Delivery fee" },
    });
    fireEvent.change(screen.getByLabelText("cashierCart.customItem.price"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.customItem.add" }));

    await waitFor(() => expect(cart().items).toHaveLength(1));
    expect(cart().items[0]).toMatchObject({ menuItemId: null, isCustom: true, unitPrice: 4 });
    expect(await screen.findByText("Delivery fee")).toBeTruthy();
  });

  it("Split Bill opens the split dialog", () => {
    cart().addItem("m1", "Ramen", 10, 2);
    renderCart();
    fireEvent.click(button("cashierCart.actions.more"));
    fireEvent.click(document.querySelector('button[data-action="splitBill"]') as HTMLElement);
    expect(screen.getByTestId("split-dialog")).toBeTruthy();
  });
});

describe("PosCart — Clear sale", () => {
  it("asks first, then wipes lines, customer and discount", async () => {
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setDiscount(10, "Regular");
    cart().setCustomer({
      id: "c1",
      name: "Alice",
      phone: null,
      email: null,
      points: 0,
      lifetimeSpend: 0,
    });
    renderCart();

    fireEvent.click(screen.getByRole("button", { name: "cashierCart.header.clearSale" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(cart().items).toHaveLength(1); // not yet
    fireEvent.click(within(dialog).getByRole("button", { name: "cashierCart.header.clearSale" }));

    await waitFor(() => expect(cart().items).toHaveLength(0));
    expect(cart().customer).toBeNull();
    expect(cart().discountSource).toBeNull();
  });

  it("does nothing when the cashier backs out", async () => {
    cart().addItem("m1", "Ramen", 100, 1);
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.header.clearSale" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(cart().items).toHaveLength(1);
  });
});

// ── Save Bill / Print Bill ───────────────────────────────────────────────────

describe("PosCart — Print Bill", () => {
  it("prints a provisional bill built from the cart: documentType 'bill', no payment, store currency", async () => {
    env.finance = finance({ taxEnabled: true, taxRate: 0.1, taxInclusive: true, taxLabel: "TVA" });
    cart().addItem("m1", "Ramen", 110, 1);
    cart().setTableNumber("A1");
    renderCart();

    fireEvent.click(button("cashierCart.footer.printBill"));
    await waitFor(() => expect(env.print).toHaveBeenCalledTimes(1));

    const bill = env.print.mock.calls[0][0] as ReceiptData;
    expect(bill).toMatchObject({
      documentType: "bill",
      storeName: "Café Rivoli",
      currency: "EUR",
      total: 110,
      subtotal: 100,
      tax: 10,
      taxLabel: "TVA",
      tableLabel: "A1",
      cashierName: "Léa",
      width: 32,
      paymentMethod: "",
      tagline: "Always fresh",
    });
    expect(bill.items).toHaveLength(1);
    expect(bill.amountTendered).toBeUndefined();
  });

  it("prints a resumed bill under its real number", async () => {
    env.orders = [{ id: "order_1", orderNumber: "POS-20260919-XYZ", status: "HELD" }];
    cart().hydrateFromOrder(
      [
        {
          id: "l1",
          menuItemId: "m1",
          name: "Ramen",
          unitPrice: 10,
          quantity: 1,
          modifiers: [],
          lineTotal: 10,
        },
      ],
      "order_1"
    );
    renderCart();
    fireEvent.click(button("cashierCart.footer.printBill"));
    await waitFor(() => expect(env.print).toHaveBeenCalled());
    expect((env.print.mock.calls[0][0] as ReceiptData).orderNumber).toBe("POS-20260919-XYZ");
  });

  it("does not empty or otherwise touch the cart", async () => {
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.footer.printBill"));
    await waitFor(() => expect(env.print).toHaveBeenCalled());
    expect(cart().items).toHaveLength(1);
  });
});

describe("PosCart — Save Bill", () => {
  it("opens the prefilled dialog, saves with the customer and discount, then clears the cart", async () => {
    post.mockResolvedValue({ orderId: "o1", orderNumber: "POS-1" });
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setOrderType("TAKEAWAY");
    cart().setCustomer({
      id: "c1",
      name: "Alice",
      phone: "+33612345678",
      email: null,
      points: 0,
      lifetimeSpend: 0,
    });
    cart().setDiscountSource({
      kind: "preset",
      presetId: "p1",
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    renderCart();

    fireEvent.click(button("cashierCart.footer.saveBill"));
    expect(screen.getByRole("heading", { name: "cashierCart.saveBill.title" })).toBeTruthy();
    expect(screen.getByTestId("hold-summary").textContent).toBe("Take Away · Alice");
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.saveBill.submit" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/stores/s1/pos/orders/hold");
    expect(post.mock.calls[0][1]).toMatchObject({
      orderType: "TAKEAWAY",
      customerId: "c1",
      customerName: "Alice",
      customerPhone: "+33612345678",
      presetId: "p1",
      shiftId: "shift_1",
    });
    // A preset goes as its id only — the server re-prices it.
    expect(post.mock.calls[0][1]).not.toHaveProperty("discountAmount");
    await waitFor(() => expect(cart().items).toHaveLength(0));
    expect(toast.success).toHaveBeenCalledWith("cashierCart.saveBill.saved");
  });

  it("re-saves a resumed bill in place", async () => {
    post.mockResolvedValue({ orderId: "order_1", orderNumber: "POS-1" });
    cart().hydrateFromOrder(
      [
        {
          id: "l1",
          menuItemId: "m1",
          name: "Ramen",
          unitPrice: 10,
          quantity: 1,
          modifiers: [],
          lineTotal: 10,
        },
      ],
      "order_1"
    );
    renderCart();
    fireEvent.click(button("cashierCart.footer.saveBill"));
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.saveBill.submit" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ orderId: "order_1" });
  });

  it("warns in the dialog when a coupon or points won't be saved", () => {
    cart().addItem("m1", "Ramen", 100, 1);
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "cp1",
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
      minSubtotal: null,
    });
    renderCart();
    fireEvent.click(button("cashierCart.footer.saveBill"));
    expect(screen.getByText("cashierCart.saveBill.dropsPromotions")).toBeTruthy();
  });

  it("offline: explains instead of opening the dialog", () => {
    env.online = false;
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.footer.saveBill"));
    expect(toast.error).toHaveBeenCalledWith("cashierCart.saveBill.offline");
    expect(screen.queryByRole("heading", { name: "cashierCart.saveBill.title" })).toBeNull();
  });

  it("with the Active Queue off: explains instead of opening the dialog", () => {
    env.kdsEnabled = false;
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.footer.saveBill"));
    expect(toast.error).toHaveBeenCalledWith("cashierCart.saveBill.unavailable");
    expect(screen.queryByRole("heading", { name: "cashierCart.saveBill.title" })).toBeNull();
  });

  it("keeps the cart and shows the server's reason when saving fails", async () => {
    const { ApiClientError } = await import("@/lib/api/client");
    post.mockRejectedValue(
      new ApiClientError(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "Ramen is no longer on the menu" },
        } as any,
        422
      )
    );
    cart().addItem("m1", "Ramen", 10, 1);
    renderCart();
    fireEvent.click(button("cashierCart.footer.saveBill"));
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.saveBill.submit" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ramen is no longer on the menu"));
    expect(cart().items).toHaveLength(1);
  });
});
