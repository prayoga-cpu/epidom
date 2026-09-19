import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import { usePosSession } from "../use-pos-session";
import { useCloseShift, useMyShift, useOpenShift, type MyShift } from "../use-my-shift";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);

const STAFF_ID = "clstaff000000000000000001";
const OWNER_ROW_ID = "clowner0000000000000000001";

function shiftRow(overrides: Partial<MyShift> = {}): MyShift {
  return {
    id: "clshift000000000000000001",
    openedAt: "2026-09-11T11:00:00.000Z",
    closedAt: null,
    openingCash: "100000",
    closingCash: null,
    staffMember: { id: STAFF_ID, name: "Sam", role: "CASHIER" },
    ...overrides,
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function session(overrides: Partial<ReturnType<typeof usePosSession.getState>> = {}) {
  usePosSession.setState({
    isActive: true,
    storeId: "s1",
    staffId: STAFF_ID,
    staffName: "Sam",
    staffRole: "CASHIER",
    allowedPages: ["/pos", "/pos/orders"],
    shiftId: null,
    ...overrides,
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  localStorage.clear();
  session();
});

describe("useMyShift", () => {
  it("asks for the persona's newest shift and returns it when it is open", async () => {
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));
    expect(get).toHaveBeenCalledWith("/stores/s1/shifts", { staffId: STAFF_ID, take: "1" });
    expect(result.current.known).toBe(true);
  });

  it("the newest shift being closed means there is no open shift", async () => {
    get.mockResolvedValue({ shifts: [shiftRow({ closedAt: "2026-09-11T20:00:00.000Z" })] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.shift).toBeNull();
  });

  it("points the POS session at a shift opened after login, so sales attach to it", async () => {
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001"));
  });

  it("unlinks a session shift that was closed elsewhere", async () => {
    session({ shiftId: "clshift000000000000000001" });
    get.mockResolvedValue({ shifts: [] });
    const { wrapper } = setup();
    renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(usePosSession.getState().shiftId).toBeNull());
  });

  it("does NOT unlink the session on a failed read — unknown is not 'closed'", async () => {
    session({ shiftId: "clshift000000000000000001" });
    get.mockRejectedValue(new Error("offline"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.known).toBe(false);
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
  });

  it("kitchen holds no till: not allowed and no request made", async () => {
    session({ staffRole: "KITCHEN", allowedPages: ["/pos/kds"] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    expect(result.current.allowed).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("a persona from another store is not allowed here", () => {
    session({ storeId: "other-store" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });
    expect(result.current.allowed).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("the owner persona works the till as the store's OWNER staff row", async () => {
    session({ staffId: "owner", staffName: "Owner", staffRole: "OWNER", allowedPages: null });
    get.mockImplementation(async (url: string) => {
      if (url === "/stores/s1/staff") {
        return {
          staff: [
            { id: STAFF_ID, role: "CASHIER", isActive: true },
            { id: OWNER_ROW_ID, role: "OWNER", isActive: true },
          ],
        };
      }
      return { shifts: [] };
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.staffMemberId).toBe(OWNER_ROW_ID));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/stores/s1/shifts", { staffId: OWNER_ROW_ID, take: "1" })
    );
  });

  it("an owner with no OWNER staff row has nothing to attribute a shift to", async () => {
    session({ staffId: "owner", staffName: "Owner", staffRole: "OWNER", allowedPages: null });
    get.mockResolvedValue({ staff: [{ id: STAFF_ID, role: "CASHIER", isActive: true }] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.staffMemberId).toBeNull();
    expect(get).not.toHaveBeenCalledWith("/stores/s1/shifts", expect.anything());
  });
});

describe("opening and closing keep the session honest", () => {
  it("opening a shift links the session and is not undone by the stale 'no shift' read", async () => {
    get.mockResolvedValueOnce({ shifts: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ mine: useMyShift("s1"), open: useOpenShift("s1") }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.mine.known).toBe(true));

    // The refetch after opening never lands during this test.
    get.mockReturnValue(new Promise(() => {}));
    post.mockResolvedValue({ shift: shiftRow() });
    await act(async () => {
      await result.current.open.mutateAsync({ staffId: STAFF_ID, pin: "", openingCash: 100_000 });
    });

    expect(post).toHaveBeenCalledWith("/stores/s1/shifts", {
      staffId: STAFF_ID,
      pin: "",
      openingCash: 100_000,
    });
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
    // The cache was seeded from the response, so the reconcile effect agrees.
    await waitFor(() => expect(result.current.mine.shift?.id).toBe("clshift000000000000000001"));
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
  });

  it("closing a shift unlinks the session and stays unlinked while the refetch is in flight", async () => {
    session({ shiftId: "clshift000000000000000001" });
    get.mockResolvedValueOnce({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ mine: useMyShift("s1"), close: useCloseShift("s1") }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.mine.shift).not.toBeNull());

    get.mockReturnValue(new Promise(() => {}));
    patch.mockResolvedValue({ shift: shiftRow({ closedAt: "2026-09-11T20:00:00.000Z" }) });
    await act(async () => {
      await result.current.close.mutateAsync({
        shiftId: "clshift000000000000000001",
        closingCash: 180_000,
        notes: "all good",
      });
    });

    expect(patch).toHaveBeenCalledWith("/stores/s1/shifts/clshift000000000000000001", {
      closingCash: 180_000,
      notes: "all good",
    });
    await waitFor(() => expect(result.current.mine.shift).toBeNull());
    // Not re-attached to the shift that was just signed off.
    expect(usePosSession.getState().shiftId).toBeNull();
  });
});
