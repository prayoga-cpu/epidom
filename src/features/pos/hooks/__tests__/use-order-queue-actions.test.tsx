import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createQueryWrapper } from "../../components/__tests__/cart-test-utils";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("../../components/__tests__/cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { useOrderQueueActions } from "../use-order-queue-actions";
import { usePosCart } from "../use-pos-cart";
import type { PosOrderDisplay } from "../../types/pos.types";

const get = vi.mocked(apiClient.get);
const cart = () => usePosCart.getState();

const heldOrder = {
  id: "order_1",
  orderNumber: "POS-1",
  status: "HELD",
  source: "POS",
  orderType: "TAKEAWAY",
  paymentMethod: "CASH",
  paymentStatus: "PENDING",
  customerId: "c1",
  customerName: "Alice",
  guestCount: null,
  tableNumber: "B2",
  discountAmount: 4,
  discountReason: "Regular",
  subtotal: 0,
  total: 0,
  createdAt: "2026-09-19T00:00:00.000Z",
  items: [
    {
      id: "i1",
      menuItemId: "m1",
      name: "Ramen",
      quantity: 2,
      unitPrice: 10,
      total: 20,
      status: "PENDING",
      selectedOptions: [],
    },
    {
      id: "i2",
      menuItemId: null,
      isCustom: true,
      department: "BAR",
      name: "Extra shot",
      quantity: 1,
      unitPrice: 3,
      total: 3,
      status: "SERVED",
    },
    {
      id: "i3",
      menuItemId: null,
      isCustom: true,
      department: null,
      name: "Extra shot",
      quantity: 1,
      unitPrice: 3,
      total: 3,
      status: "SERVED",
    },
  ],
} as unknown as PosOrderDisplay;

beforeEach(() => {
  localStorage.clear();
  cart().clearCart();
  router.push.mockReset();
  get.mockReset();
  get.mockResolvedValue({
    id: "c1",
    name: "Alice Martin",
    phone: "+33612345678",
    email: null,
    notes: null,
    points: 80,
    memberSince: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lifetimeSpend: 300,
    orderCount: 2,
    lastOrderAt: null,
    orders: [],
    loyaltyEntries: [],
  } as any);
});

describe("useOrderQueueActions — resuming a saved bill", () => {
  it("restores the lines (custom ones as their own lines), order type, table, customer and discount", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOrderQueueActions(heldOrder, "s1", vi.fn()), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.handleResume();
    });

    expect(cart().resumingOrderId).toBe("order_1");
    expect(
      cart().items.map((i) => [i.name, i.menuItemId, i.isCustom ?? false, i.department ?? null])
    ).toEqual([
      ["Ramen", "m1", false, null],
      ["Extra shot", null, true, "BAR"],
      ["Extra shot", null, true, null],
    ]);
    expect(cart()).toMatchObject({ orderType: "TAKEAWAY", tableNumber: "B2", guestCount: 1 });
    expect(cart().customer).toMatchObject({ id: "c1", name: "Alice Martin", points: 80 });
    expect(cart().discountSource).toEqual({ kind: "manual", amount: 4, reason: "Regular" });
    expect(cart().total).toBe(22); // 26 − 4
    expect(get).toHaveBeenCalledWith("/stores/s1/customers/c1");
  });

  it("then tells the cashier and goes back to the register", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOrderQueueActions(heldOrder, "s1", vi.fn()), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.handleResume();
    });
    expect(toast.success).toHaveBeenCalledWith("pos.orderCard.resumeSuccess");
    expect(router.push).toHaveBeenCalledWith("/store/s1/pos");
  });
});
