import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — factories must not reference external let/const.

const mockUsePwaInstall = vi.fn();
vi.mock("@/hooks/use-pwa-install", () => ({
  usePwaInstall: () => mockUsePwaInstall(),
}));

const offlineModeStore = new Map<string, boolean>();
vi.mock("@/lib/pwa/offline-mode", () => ({
  getOfflineModeState: vi.fn((storeId: string) =>
    Promise.resolve(offlineModeStore.has(storeId) ? offlineModeStore.get(storeId)! : null)
  ),
  isOfflineModeEnabled: vi.fn((storeId: string) =>
    Promise.resolve(offlineModeStore.get(storeId) ?? false)
  ),
  setOfflineModeEnabled: vi.fn((storeId: string, enabled: boolean) => {
    offlineModeStore.set(storeId, enabled);
    return Promise.resolve();
  }),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useOfflineMode } from "../use-offline-mode";
import { setOfflineModeEnabled } from "@/lib/pwa/offline-mode";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  offlineModeStore.clear();
  mockUsePwaInstall.mockReturnValue({ isStandalone: false, canInstall: false, install: vi.fn() });
});

describe("useOfflineMode", () => {
  it("does not auto-enable when the app is not running standalone", async () => {
    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(setOfflineModeEnabled).not.toHaveBeenCalled();
  });

  it("auto-enables the first time the app is detected running standalone (installed)", async () => {
    mockUsePwaInstall.mockReturnValue({ isStandalone: true, canInstall: false, install: vi.fn() });

    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(setOfflineModeEnabled).toHaveBeenCalledWith("store-1", true);
  });

  it("re-enables even if the user had previously turned it off — no opt-out once installed", async () => {
    offlineModeStore.set("store-1", false);
    mockUsePwaInstall.mockReturnValue({ isStandalone: true, canInstall: false, install: vi.fn() });

    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(setOfflineModeEnabled).toHaveBeenCalledWith("store-1", true);
  });

  it("reports enabled immediately while standalone, even before the persisted state loads", () => {
    mockUsePwaInstall.mockReturnValue({ isStandalone: true, canInstall: false, install: vi.fn() });

    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });

    // Synchronous first render, before any async effect has resolved.
    expect(result.current.enabled).toBe(true);
  });

  it("disableOfflineMode is a no-op while standalone", async () => {
    offlineModeStore.set("store-1", true);
    mockUsePwaInstall.mockReturnValue({ isStandalone: true, canInstall: false, install: vi.fn() });

    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.enabled).toBe(true));

    vi.clearAllMocks();
    await result.current.disableOfflineMode();

    expect(setOfflineModeEnabled).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(true);
  });

  it("disableOfflineMode still works when not standalone", async () => {
    offlineModeStore.set("store-1", true);
    mockUsePwaInstall.mockReturnValue({ isStandalone: false, canInstall: false, install: vi.fn() });

    const { result } = renderHook(() => useOfflineMode("store-1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await result.current.disableOfflineMode();

    expect(setOfflineModeEnabled).toHaveBeenCalledWith("store-1", false);
  });
});
