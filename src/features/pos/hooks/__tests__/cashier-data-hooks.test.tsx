import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import {
  CUSTOMER_SEARCH_LIMIT,
  toCartCustomer,
  useCreateCustomer,
  useCustomerDetail,
  useCustomerSearch,
} from "../use-customers";
import { useDiscountPresets } from "../use-discount-presets";
import { useLoyaltySettings } from "../use-loyalty-settings";
import { useValidateCoupon } from "../use-coupon";
import { useMergeOrders } from "../use-merge-orders";
import { usePosOrdersSnapshot } from "../use-pos-orders-snapshot";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("customers", () => {
  it("searches GET /customers with the query and the quick-picker limit", async () => {
    get.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 });
    const { wrapper } = setup();
    renderHook(() => useCustomerSearch("s1", "  ali  "), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get).toHaveBeenCalledWith("/stores/s1/customers", {
      q: "ali",
      limit: String(CUSTOMER_SEARCH_LIMIT),
    });
    expect(CUSTOMER_SEARCH_LIMIT).toBe(8);
  });

  it("an empty query is a valid request (the default first page)", async () => {
    get.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 });
    const { wrapper } = setup();
    renderHook(() => useCustomerSearch("s1", ""), { wrapper });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/stores/s1/customers", { q: "", limit: "8" })
    );
  });

  it("does not search while disabled (offline, or the row isn't expanded)", () => {
    const { wrapper } = setup();
    renderHook(() => useCustomerSearch("s1", "x", false), { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it("reads one customer fresh from GET /customers/[id], never from a stale cache", async () => {
    get.mockResolvedValue({ id: "c1" });
    const { wrapper } = setup();
    renderHook(() => useCustomerDetail("s1", "c1"), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/stores/s1/customers/c1"));
  });

  it("doesn't read a customer when there isn't one", () => {
    const { wrapper } = setup();
    renderHook(() => useCustomerDetail("s1", null), { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it("creates a customer with POST /customers and refreshes the search lists", async () => {
    post.mockResolvedValue({ id: "c9", name: "Bob" });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCreateCustomer("s1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: "Bob", phone: "+33" });
    });
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", { name: "Bob", phone: "+33" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pos", "customers", "s1", "search"] });
  });

  it("snapshots a row down to what the cart carries", () => {
    const row = {
      id: "c1",
      name: "Alice",
      phone: "+33",
      email: null,
      points: 5,
      lifetimeSpend: 9.5,
      // Full row fields that must not leak into the cart snapshot.
      orderCount: 3,
      notes: "vip",
    };
    expect(toCartCustomer(row)).toEqual({
      id: "c1",
      name: "Alice",
      phone: "+33",
      email: null,
      points: 5,
      lifetimeSpend: 9.5,
    });
  });
});

describe("plan-gated reads stay quiet below the plan (no 403 noise)", () => {
  it("presets", async () => {
    get.mockResolvedValue([]);
    const off = setup();
    renderHook(() => useDiscountPresets("s1", false), { wrapper: off.wrapper });
    expect(get).not.toHaveBeenCalled();

    const on = setup();
    renderHook(() => useDiscountPresets("s1", true), { wrapper: on.wrapper });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/stores/s1/discount-presets"));
  });

  it("loyalty settings", async () => {
    get.mockResolvedValue({ enabled: false, spendPerPoint: 0, pointValue: 0, minRedeemPoints: 0 });
    const off = setup();
    renderHook(() => useLoyaltySettings("s1", false), { wrapper: off.wrapper });
    expect(get).not.toHaveBeenCalled();

    const on = setup();
    renderHook(() => useLoyaltySettings("s1", true), { wrapper: on.wrapper });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/stores/s1/loyalty-settings"));
  });
});

describe("coupons", () => {
  it("validates with POST /coupons/validate and resolves a rejection (HTTP 200) instead of throwing", async () => {
    post.mockResolvedValue({ valid: false, reason: "EXPIRED" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useValidateCoupon("s1"), { wrapper });
    let verdict: unknown;
    await act(async () => {
      verdict = await result.current.mutateAsync({ code: "OLD", itemsTotal: 40 });
    });
    expect(post).toHaveBeenCalledWith("/stores/s1/coupons/validate", {
      code: "OLD",
      itemsTotal: 40,
    });
    expect(verdict).toEqual({ valid: false, reason: "EXPIRED" });
  });
});

describe("merge", () => {
  it("POSTs the target and sources, then refreshes the queue and history", async () => {
    post.mockResolvedValue({ orderId: "t", orderNumber: "POS-T", mergedCount: 2, total: 30 });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useMergeOrders("s1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ targetOrderId: "t", sourceOrderIds: ["a", "b"] });
    });
    expect(post).toHaveBeenCalledWith("/stores/s1/pos/orders/merge", {
      targetOrderId: "t",
      sourceOrderIds: ["a", "b"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pos", "orders", "s1"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["pos", "order-history", "s1"],
      exact: false,
    });
  });
});

describe("usePosOrdersSnapshot", () => {
  it("shares usePosOrders' query key, so PosShell's live instance keeps it fresh", async () => {
    get.mockResolvedValue([{ id: "o1" }]);
    const { wrapper, client } = setup();
    const { result } = renderHook(() => usePosOrdersSnapshot("s1"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "o1" }]));
    expect(get).toHaveBeenCalledWith("/stores/s1/pos/orders");
    expect(client.getQueryData(["pos", "orders", "s1"])).toEqual([{ id: "o1" }]);
  });
});
