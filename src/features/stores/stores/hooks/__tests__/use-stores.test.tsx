import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { isUnauthorizedError } from "@/lib/api/unauthorized";
import { useStores } from "../use-stores";

function wrapper({ children }: { children: ReactNode }) {
  // retryDelay 0: the hook's own `retry` decides whether to retry; the delay only
  // has to be short enough not to slow the one case that does.
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

describe("useStores", () => {
  it("returns the stores on success", async () => {
    respondWith(200, { success: true, data: [{ id: "s1", name: "Cafe" }] });
    const { result } = renderHook(() => useStores(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "s1", name: "Cafe" }]);
  });

  it("keeps a 401 as an UnauthorizedError — and never retries it, since it can't succeed", async () => {
    const fetchMock = respondWith(401, {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
    const { result } = renderHook(() => useStores(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isUnauthorizedError(result.current.error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("any other failure keeps the server's message, is not 'signed out', and is retried once", async () => {
    const fetchMock = respondWith(500, {
      success: false,
      error: { code: "INTERNAL", message: "Database is down" },
    });
    const { result } = renderHook(() => useStores(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Database is down");
    expect(isUnauthorizedError(result.current.error)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
