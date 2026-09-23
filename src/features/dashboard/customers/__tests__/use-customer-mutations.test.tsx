import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { get: h.get, post: h.post, patch: h.patch } };
});

import {
  invalidateCustomerQueries,
  useAdjustPoints,
  useCreateCustomer,
  useUpdateCustomer,
} from "../hooks/use-customer-mutations";
import { customerKeys } from "../hooks/use-customer-queries";
import { makeCustomer, makeDetail } from "./helpers";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

const invalidatedKeys = (spy: ReturnType<typeof setup>["invalidate"]) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invalidateCustomerQueries", () => {
  it("refreshes both the Back Office prefix and the POS picker's separate root", () => {
    const { client, invalidate } = setup();
    invalidateCustomerQueries(client, "s1");
    expect(invalidatedKeys(invalidate)).toEqual([
      ["customers", "s1"],
      ["pos", "customers", "s1"],
    ]);
  });

  it("is scoped to the one store", () => {
    const { client, invalidate } = setup();
    invalidateCustomerQueries(client, "s1");
    expect(JSON.stringify(invalidatedKeys(invalidate))).not.toContain("s2");
  });
});

describe("useCreateCustomer", () => {
  it("posts the body to the store's customers route and invalidates the customer caches", async () => {
    h.post.mockResolvedValue(makeCustomer());
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateCustomer("s1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Marie", phone: "+33612345678" });
    });

    expect(h.post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: "Marie",
      phone: "+33612345678",
    });
    expect(invalidatedKeys(invalidate)).toContainEqual(["customers", "s1"]);
    expect(invalidatedKeys(invalidate)).toContainEqual(["pos", "customers", "s1"]);
  });

  it("does not invalidate anything when the server refuses (a 409 must leave the form alone)", async () => {
    h.post.mockRejectedValue(new Error("Conflict"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateCustomer("s1"), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: "Marie" })).rejects.toThrow("Conflict");
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useUpdateCustomer", () => {
  it("PATCHes the customer and seeds the open detail with the response", async () => {
    const detail = makeDetail({ name: "Marie D." });
    h.patch.mockResolvedValue(detail);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateCustomer("s1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ customerId: "c1", body: { name: "Marie D." } });
    });

    expect(h.patch).toHaveBeenCalledWith("/stores/s1/customers/c1", { name: "Marie D." });
    expect(client.getQueryData(customerKeys.detail("s1", "c1"))).toEqual(detail);
  });
});

describe("useAdjustPoints", () => {
  it("posts the signed points and folds the new balance into the cached detail", async () => {
    h.post.mockResolvedValue(makeCustomer({ points: 70 }));
    const { client, invalidate, wrapper } = setup();
    client.setQueryData(customerKeys.detail("s1", "c1"), makeDetail({ points: 100 }));
    const { result } = renderHook(() => useAdjustPoints("s1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ customerId: "c1", body: { points: -30, note: "Fix" } });
    });

    expect(h.post).toHaveBeenCalledWith("/stores/s1/customers/c1/points", {
      points: -30,
      note: "Fix",
    });
    await waitFor(() => {
      const cached = client.getQueryData<ReturnType<typeof makeDetail>>(
        customerKeys.detail("s1", "c1")
      );
      expect(cached?.points).toBe(70);
      // The ledger and orders survive until the refetch replaces them.
      expect(cached?.loyaltyEntries).toHaveLength(2);
    });
    expect(invalidatedKeys(invalidate)).toContainEqual(["customers", "s1"]);
  });

  it("leaves a detail that was never opened alone", async () => {
    h.post.mockResolvedValue(makeCustomer({ points: 70 }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useAdjustPoints("s1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ customerId: "c9", body: { points: 5, note: "x" } });
    });

    expect(client.getQueryData(customerKeys.detail("s1", "c9"))).toBeUndefined();
  });
});
