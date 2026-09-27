import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { isUnauthorizedError } from "@/lib/api/unauthorized";
import { setupProgressKey, useSetupProgress } from "../use-setup-progress";

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

const PROGRESS = { storeId: "s1", items: [], sections: ["storefront"], completed: 0, total: 6 };

beforeEach(() => vi.restoreAllMocks());

describe("useSetupProgress", () => {
  it("is keyed per store", () => {
    expect(setupProgressKey("s1")).toEqual(["setup-progress", "s1"]);
  });

  it("returns the checklist from GET /api/stores/[id]/setup-progress", async () => {
    const fetchMock = respondWith(200, { success: true, data: PROGRESS });
    const { result } = renderHook(() => useSetupProgress("s1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PROGRESS);
    expect(fetchMock).toHaveBeenCalledWith("/api/stores/s1/setup-progress");
  });

  it("a 403 is data: null, not an error, and is not retried", async () => {
    const fetchMock = respondWith(403, { success: false });
    const { result } = renderHook(() => useSetupProgress("s1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 401 is an UnauthorizedError, never retried", async () => {
    const fetchMock = respondWith(401, { success: false });
    const { result } = renderHook(() => useSetupProgress("s1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isUnauthorizedError(result.current.error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("any other failure is retried once, then an error", async () => {
    const fetchMock = respondWith(500, { success: false });
    const { result } = renderHook(() => useSetupProgress("s1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches on remount and on window focus even while the data is fresh (Back to the dashboard within 30 s)", async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    const sharedWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={shared}>{children}</QueryClientProvider>
    );
    const fetchMock = respondWith(200, { success: true, data: PROGRESS });

    const first = renderHook(() => useSetupProgress("s1"), { wrapper: sharedWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // The dashboard remounts a moment later (staleTime is 30 s): it still asks.
    const second = renderHook(() => useSetupProgress("s1"), { wrapper: sharedWrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));

    // Coming back to the tab asks again too.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    focusManager.setFocused(undefined);
    second.unmount();
  });

  it("does not fetch while disabled or without a store id", async () => {
    const fetchMock = respondWith(200, { success: true, data: PROGRESS });
    renderHook(() => useSetupProgress("s1", { enabled: false }), { wrapper });
    renderHook(() => useSetupProgress(undefined), { wrapper });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
