import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted — factories must not reference external let/const.
// The access-check hook reaches for the subscription status query; stub the
// whole module so these tests exercise the fetch/unwrap path only.
vi.mock("@/features/dashboard/data/suppliers/hooks/use-suppliers", () => ({
  useSupplierAccessStatus: () => ({
    hasAccess: true,
    hasNoAccess: false,
    isCheckingAccess: false,
  }),
  supplierKeys: {
    all: (storeId: string) => ["suppliers", storeId],
    accessCheck: (storeId: string) => ["suppliers", storeId, "access-check"],
    lists: (storeId: string) => ["suppliers", storeId, "list"],
  },
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useSupplierOrders,
  useSupplierOrder,
  useCreateSupplierOrder,
} from "../use-supplier-orders";

const STORE_ID = "cmppdqplp000004l88zerz2ad";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    storeId: STORE_ID,
    supplierId: "supplier-1",
    supplier: { id: "supplier-1", name: "Grain & Co", email: null, phone: null },
    orderNumber: "SO-1786871799751-0002",
    status: "PENDING",
    orderDate: "2026-08-16T00:00:00.000Z",
    expectedDate: "2026-08-16T00:00:00.000Z",
    receivedDate: null,
    subtotal: 79.8,
    tax: 0,
    shipping: 0,
    total: 79.8,
    notes: null,
    items: [],
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Every API route answers through `createSuccessResponse`, which wraps the
 * payload as { success, data, meta }. These hooks used to hand that envelope
 * straight to React Query, so `data.orders` read as undefined and a
 * just-created order vanished from "Orders to Place" on the next refetch.
 */
function wrapped(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: { timestamp: "2026-08-16T00:00:00.000Z" } }),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSupplierOrders", () => {
  it("unwraps the createSuccessResponse envelope so data.orders is the array", async () => {
    const order = makeOrder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => wrapped({ orders: [order] }))
    );

    const { result } = renderHook(() => useSupplierOrders(STORE_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.orders)).toBe(true);
    expect(result.current.data?.orders).toHaveLength(1);
    expect(result.current.data?.orders[0].orderNumber).toBe("SO-1786871799751-0002");
    // The envelope must not survive into the cache.
    expect(result.current.data).not.toHaveProperty("success");
    expect(result.current.data).not.toHaveProperty("meta");
  });

  it("keeps a PENDING order visible after a client refetch replaces the SSR initialData", async () => {
    // The exact reported symptom: the page paints from correctly-shaped server
    // data, then the first client fetch overwrites the cache and the list
    // empties out. The two payloads carry different order numbers on purpose —
    // asserting on the fresh one is what makes this fail when the refetched
    // body is left wrapped, instead of passing against the stale initialData.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => wrapped({ orders: [makeOrder({ orderNumber: "SO-FRESH" })] }))
    );

    const { result } = renderHook(
      () =>
        useSupplierOrders(STORE_ID, {
          orders: [makeOrder({ id: "ssr-order", orderNumber: "SO-FROM-SSR" })] as never,
        }),
      { wrapper: makeWrapper() }
    );

    expect(result.current.data?.orders?.[0].orderNumber).toBe("SO-FROM-SSR");

    await result.current.refetch();

    await waitFor(() => {
      const pending = result.current.data?.orders?.filter((o) => o.status === "PENDING");
      expect(pending).toHaveLength(1);
      expect(pending?.[0].orderNumber).toBe("SO-FRESH");
    });
  });

  it("recognises a subscription-locked 403 through the error envelope", async () => {
    // createErrorResponse nests code/message under `error`. Reading them off
    // the top level returned undefined, so the upgrade prompt never triggered
    // and the user saw a bare "Failed to fetch supplier orders".
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              error: {
                code: "SUBSCRIPTION_FEATURE_LOCKED",
                message: "Supplier Management is only available in Pro and Enterprise plans",
              },
            }),
          }) as Response
      )
    );

    const { result } = renderHook(() => useSupplierOrders(STORE_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as Error & { code?: string; upgradeRequired?: boolean };
    expect(error.code).toBe("SUBSCRIPTION_FEATURE_LOCKED");
    expect(error.upgradeRequired).toBe(true);
    expect(error.message).toContain("Pro and Enterprise");
  });

  it("tolerates an already-unwrapped body", async () => {
    // Defensive: the SSR fetcher builds this shape directly, with no envelope.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: true, status: 200, json: async () => ({ orders: [makeOrder()] }) }) as Response
      )
    );

    const { result } = renderHook(() => useSupplierOrders(STORE_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.orders).toHaveLength(1);
  });
});

describe("useSupplierOrder", () => {
  it("unwraps the envelope so data.order is defined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => wrapped({ order: makeOrder() }))
    );

    const { result } = renderHook(() => useSupplierOrder(STORE_ID, "order-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The send-to-supplier dialog reads `data?.order` and disables itself when
    // it's missing, which is what the envelope caused.
    expect(result.current.data?.order?.orderNumber).toBe("SO-1786871799751-0002");
  });
});

describe("useCreateSupplierOrder", () => {
  it("returns the created order so the caller can link to its printable quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              data: { order: makeOrder() },
              meta: { timestamp: "2026-08-16T00:00:00.000Z" },
            }),
          }) as Response
      )
    );

    const { result } = renderHook(() => useCreateSupplierOrder(STORE_ID), {
      wrapper: makeWrapper(),
    });

    const created = await result.current.mutateAsync({
      supplierId: "supplier-1",
      items: [{ materialId: "mat-1", quantity: 20, unit: "kg", unitPrice: 3.99 }],
      expectedDate: "2026-08-16",
    });

    expect(created.id).toBe("order-1");
    expect(created.orderNumber).toBe("SO-1786871799751-0002");
  });

  it("surfaces the server's error message rather than [object Object]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 400,
            json: async () => ({
              success: false,
              error: { code: "VALIDATION_ERROR", message: "Supplier not found" },
            }),
          }) as Response
      )
    );

    const { result } = renderHook(() => useCreateSupplierOrder(STORE_ID), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        supplierId: "supplier-1",
        items: [{ materialId: "mat-1", quantity: 1, unit: "kg", unitPrice: 1 }],
      })
    ).rejects.toThrow("Supplier not found");
  });
});
