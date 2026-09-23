import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createQueryWrapper, stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  return { useCurrency: () => makeCurrencyMock("EUR") };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const queue = vi.hoisted(() => ({ orders: [] as unknown[] }));
vi.mock("../../hooks/use-pos-orders-snapshot", () => ({
  usePosOrdersSnapshot: () => ({ data: queue.orders, isLoading: false }),
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { toast } from "sonner";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { PosMergeBillDialog, matchesMergeQuery } from "../pos-merge-bill-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const cart = () => usePosCart.getState();

const held = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  orderNumber: `POS-${id.toUpperCase()}`,
  status: "HELD",
  customerName: "Walk-in",
  tableNumber: null,
  total: 20,
  items: [{ id: `${id}-i`, quantity: 2 }],
  ...over,
});

const mergedOrder = {
  id: "target",
  orderNumber: "POS-TARGET",
  status: "HELD",
  orderType: "TAKEAWAY",
  guestCount: null,
  tableNumber: "B2",
  customerId: null,
  customerName: "Walk-in",
  discountAmount: 0,
  items: [
    {
      id: "a",
      menuItemId: "m1",
      name: "Ramen",
      quantity: 2,
      unitPrice: 10,
      total: 20,
      status: "PENDING",
    },
    {
      id: "b",
      menuItemId: null,
      isCustom: true,
      department: "BAR",
      name: "Extra",
      quantity: 1,
      unitPrice: 5,
      total: 5,
      status: "SERVED",
    },
  ],
};

function renderDialog() {
  const { Wrapper } = createQueryWrapper();
  const onOpenChange = vi.fn();
  render(
    <Wrapper>
      <PosMergeBillDialog open onOpenChange={onOpenChange} storeId="s1" shiftId="shift_1" />
    </Wrapper>
  );
  return { onOpenChange };
}

const row = (number: string) => screen.getByRole("checkbox", { name: new RegExp(number) });
const mergeButton = () =>
  screen.getByRole("button", { name: /Merge \d+ bills/ }) as HTMLButtonElement;

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  get.mockReset();
  post.mockReset();
  queue.orders = [
    held("a", { customerName: "Alice", tableNumber: "A1" }),
    held("b"),
    held("zed", { status: "CONFIRMED" }),
    held("current"),
  ];
  post.mockImplementation(async (url: string) => {
    if (url.endsWith("/hold")) return { orderId: "target", orderNumber: "POS-TARGET" } as any;
    return { orderId: "target", orderNumber: "POS-TARGET", mergedCount: 2, total: 25 } as any;
  });
  get.mockResolvedValue(mergedOrder as any);
});

describe("matchesMergeQuery", () => {
  it("matches bill number, customer and table, case-insensitively", () => {
    const order = held("a", { customerName: "Alice", tableNumber: "A1" }) as any;
    expect(matchesMergeQuery(order, "")).toBe(true);
    expect(matchesMergeQuery(order, "pos-a")).toBe(true);
    expect(matchesMergeQuery(order, "ALI")).toBe(true);
    expect(matchesMergeQuery(order, "a1")).toBe(true);
    expect(matchesMergeQuery(order, "zzz")).toBe(false);
  });
});

describe("PosMergeBillDialog — the list", () => {
  it("lists only saved (HELD) bills", () => {
    renderDialog();
    expect(row("POS-A")).toBeTruthy();
    expect(row("POS-B")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /POS-ZED/ })).toBeNull();
  });

  it("excludes the bill currently being resumed", () => {
    cart().hydrateFromOrder([], "current");
    renderDialog();
    expect(screen.queryByRole("checkbox", { name: /POS-CURRENT/ })).toBeNull();
    expect(row("POS-A")).toBeTruthy();
  });

  it("searches by number, customer and table", () => {
    renderDialog();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "alice" } });
    expect(screen.queryByRole("checkbox", { name: /POS-B/ })).toBeNull();
    expect(row("POS-A")).toBeTruthy();
  });

  it("shows each bill's number, customer/table, item count and total in the store's currency", () => {
    renderDialog();
    const a = row("POS-A");
    expect(a.textContent).toContain("Alice");
    expect(a.textContent).toContain("Table A1");
    expect(a.textContent).toContain("2 items");
    expect(a.textContent).toContain("EUR 20.00");
  });

  it("gives each row a >=56px multi-select target", () => {
    renderDialog();
    expect(row("POS-A").className).toContain("min-h-14");
    expect(row("POS-A").getAttribute("aria-checked")).toBe("false");
    fireEvent.click(row("POS-A"));
    expect(row("POS-A").getAttribute("aria-checked")).toBe("true");
  });

  it("warns that the merged-in bills' discounts are dropped", () => {
    renderDialog();
    expect(screen.getByText(/cashierCart\.mergeDialog\.discountsDropped/)).toBeTruthy();
  });

  it("says so when there is nothing to merge", () => {
    queue.orders = [];
    renderDialog();
    expect(screen.getByText("cashierCart.mergeDialog.none")).toBeTruthy();
  });
});

describe("PosMergeBillDialog — merging into the bill on screen", () => {
  it("needs at least one ticked bill", () => {
    cart().addItem("m1", "Ramen", 10, 2);
    renderDialog();
    expect(mergeButton().disabled).toBe(true);
    fireEvent.click(row("POS-A"));
    expect(mergeButton().disabled).toBe(false);
    // The cart's bill counts as one of the merged bills.
    expect(mergeButton().textContent).toBe("Merge 2 bills");
  });

  it("saves the cart first, then merges the ticked bills into it, then reloads the cart", async () => {
    cart().addItem("m1", "Ramen", 10, 2);
    cart().setOrderType("TAKEAWAY");
    cart().setTableNumber("B2");
    const { onOpenChange } = renderDialog();
    fireEvent.click(row("POS-A"));
    fireEvent.click(row("POS-B"));
    fireEvent.click(mergeButton());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    // 1. Save Bill with what's on screen.
    expect(post.mock.calls[0][0]).toBe("/stores/s1/pos/orders/hold");
    expect(post.mock.calls[0][1]).toMatchObject({
      orderType: "TAKEAWAY",
      tableNumber: "B2",
      shiftId: "shift_1",
      items: [expect.objectContaining({ menuItemId: "m1", quantity: 2 })],
    });
    // 2. Merge the ticked bills into the just-saved target.
    expect(post.mock.calls[1]).toEqual([
      "/stores/s1/pos/orders/merge",
      { targetOrderId: "target", sourceOrderIds: ["a", "b"] },
    ]);
    // 3. The cart is now the merged order, custom line included.
    expect(get).toHaveBeenCalledWith("/stores/s1/pos/orders/target");
    expect(cart().resumingOrderId).toBe("target");
    expect(cart().items.map((i) => [i.name, i.menuItemId, i.isCustom ?? false])).toEqual([
      ["Ramen", "m1", false],
      ["Extra", null, true],
    ]);
    expect(toast.success).toHaveBeenCalled();
  });

  it("re-saves a resumed bill in place (same order id) so unsaved edits are merged too", async () => {
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
      "resumed_1"
    );
    cart().updateQuantity("l1", 3);
    renderDialog();
    fireEvent.click(row("POS-A"));
    fireEvent.click(mergeButton());
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][1]).toMatchObject({ orderId: "resumed_1" });
  });

  it("keeps the cart pointed at the saved bill if the merge itself fails", async () => {
    post.mockImplementation(async (url: string) => {
      if (url.endsWith("/hold")) return { orderId: "target", orderNumber: "POS-TARGET" } as any;
      throw new ApiClientError(
        { success: false, error: { code: "CONFLICT", message: "Order is no longer held" } } as any,
        409
      );
    });
    cart().addItem("m1", "Ramen", 10, 1);
    const { onOpenChange } = renderDialog();
    fireEvent.click(row("POS-A"));
    fireEvent.click(mergeButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Order is no longer held"));
    // A second Save Bill must update that bill, not create a duplicate.
    expect(cart().resumingOrderId).toBe("target");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("PosMergeBillDialog — merging from an empty cart", () => {
  it("needs two ticked bills, and the FIRST ticked becomes the target", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(row("POS-B"));
    expect(mergeButton().disabled).toBe(true);
    fireEvent.click(row("POS-A"));
    expect(mergeButton().disabled).toBe(false);
    expect(mergeButton().textContent).toBe("Merge 2 bills");
    fireEvent.click(mergeButton());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    // Nothing to save first: no hold call, just the merge.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/stores/s1/pos/orders/merge", {
      targetOrderId: "b",
      sourceOrderIds: ["a"],
    });
  });

  it("restores the merged bill's own context (order type, table) on the cart", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(row("POS-A"));
    fireEvent.click(row("POS-B"));
    fireEvent.click(mergeButton());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(cart()).toMatchObject({
      orderType: "TAKEAWAY",
      tableNumber: "B2",
      resumingOrderId: "target",
    });
  });
});
