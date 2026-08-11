import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — factories must not reference external let/const.

vi.mock("@/lib/api/client", () => ({
  apiClient: { patch: vi.fn(() => Promise.resolve({})) },
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useMarkOrderReady } from "../use-mark-order-ready";
import { apiClient } from "@/lib/api/client";
import type { PosOrderDisplay, PosOrderItemDisplay } from "../../types/pos.types";

const STORE_ID = "store-1";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function makeItem(overrides: Partial<PosOrderItemDisplay>): PosOrderItemDisplay {
  return {
    id: "item-1",
    menuItemId: "menu-1",
    name: "Item",
    quantity: 1,
    unitPrice: 10,
    total: 10,
    status: "PENDING",
    ...overrides,
  };
}

function makeOrder(items: PosOrderItemDisplay[]): PosOrderDisplay {
  return {
    id: "order-1",
    orderNumber: "POS-20260811-ABC123",
    status: "IN_PRODUCTION",
    source: "POS",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    customerName: "Walk-in",
    subtotal: 10,
    total: 10,
    items,
    createdAt: new Date().toISOString(),
  } as PosOrderDisplay;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMarkOrderReady", () => {
  it("PATCHes every not-yet-terminal item to READY", async () => {
    const order = makeOrder([
      makeItem({ id: "a", status: "PENDING" }),
      makeItem({ id: "b", status: "PREPARING" }),
      makeItem({ id: "c", status: "READY" }),
    ]);

    const { result } = renderHook(() => useMarkOrderReady(STORE_ID), { wrapper: makeWrapper() });
    result.current.mutate(order);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/stores/${STORE_ID}/pos/orders/order-1/items/a`,
      { status: "READY" }
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/stores/${STORE_ID}/pos/orders/order-1/items/b`,
      { status: "READY" }
    );
  });

  // The regression this hook's fallback exists for: an order made entirely of
  // CUSTOM product-line items has every item created SERVED, so the
  // item-by-item path has nothing to write and the server-side auto-advance
  // never fires. Before the fallback, "Mark All Complete" issued zero
  // requests and the order sat in IN_PRODUCTION forever.
  it("advances the order itself when every item is already terminal", async () => {
    const order = makeOrder([
      makeItem({ id: "a", status: "SERVED" }),
      makeItem({ id: "b", status: "SERVED" }),
    ]);

    const { result } = renderHook(() => useMarkOrderReady(STORE_ID), { wrapper: makeWrapper() });
    result.current.mutate(order);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(`/stores/${STORE_ID}/pos/orders/order-1`, {
      status: "READY",
    });
  });

  it("takes the item path when only some items are terminal", async () => {
    const order = makeOrder([
      makeItem({ id: "a", status: "SERVED" }),
      makeItem({ id: "b", status: "PENDING" }),
    ]);

    const { result } = renderHook(() => useMarkOrderReady(STORE_ID), { wrapper: makeWrapper() });
    result.current.mutate(order);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/stores/${STORE_ID}/pos/orders/order-1/items/b`,
      { status: "READY" }
    );
  });

  it("treats a cancelled-only order as already terminal", async () => {
    const order = makeOrder([makeItem({ id: "a", status: "CANCELLED" })]);

    const { result } = renderHook(() => useMarkOrderReady(STORE_ID), { wrapper: makeWrapper() });
    result.current.mutate(order);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith(`/stores/${STORE_ID}/pos/orders/order-1`, {
      status: "READY",
    });
  });
});
