import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { isUnauthorizedError } from "@/lib/api/unauthorized";
import { storeOverviewsKey, useStoreOverviews } from "../use-store-overviews";
import { storeKeys } from "../use-stores";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function respondWith(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  global.fetch = fetchMock as never;
  return fetchMock;
}

beforeEach(() => vi.restoreAllMocks());

describe("useStoreOverviews", () => {
  it("sits under the store-list key, so list invalidations refetch it too", () => {
    expect(storeOverviewsKey).toEqual([...storeKeys.lists(), "overview"]);
  });

  it("returns the overview rows from GET /api/stores/overview", async () => {
    const rows = [{ storeId: "s1", tagline: "Hi" }];
    const fetchMock = respondWith(200, { success: true, data: rows });
    const { result } = renderHook(() => useStoreOverviews(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledWith("/api/stores/overview");
  });

  it("keeps a 401 as an UnauthorizedError and never retries it", async () => {
    const fetchMock = respondWith(401, { success: false });
    const { result } = renderHook(() => useStoreOverviews(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isUnauthorizedError(result.current.error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("any other failure is an error the page can ignore (retried once)", async () => {
    const fetchMock = respondWith(500, { success: false });
    const { result } = renderHook(() => useStoreOverviews(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch while disabled", async () => {
    const fetchMock = respondWith(200, { success: true, data: [] });
    const { result } = renderHook(() => useStoreOverviews(false), { wrapper });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
