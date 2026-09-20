import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import { usePosSession } from "../use-pos-session";
import { useCloseShift, useActiveShift, useOpenShift, type TillShift } from "../use-active-shift";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);

const STAFF_ID = "clstaff000000000000000001";
const OWNER_ROW_ID = "clowner0000000000000000001";

function shiftRow(overrides: Partial<TillShift> = {}): TillShift {
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
    // A login in an earlier test stamps this; left over, it makes the next test's
    // first answer look older than its own login and triggers a stray refetch.
    pinVerifiedAt: null,
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

describe("useActiveShift", () => {
  it("asks for the STORE's open shift — no staff filter — and returns it", async () => {
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));
    // `status: open` is filtered by the server; `staffId` must NOT be sent, or a
    // shift the owner opened would be invisible to the cashier who takes over.
    expect(get).toHaveBeenCalledWith("/stores/s1/shifts", { status: "open", take: "1" });
    expect(result.current.known).toBe(true);
  });

  it("shows a shift somebody else opened, and attributes it to them", async () => {
    // Persona is Sam (CASHIER); the till was opened by the owner earlier.
    get.mockResolvedValue({
      shifts: [shiftRow({ staffMember: { id: OWNER_ROW_ID, name: "Owner", role: "OWNER" } })],
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.shift?.staffMember?.name).toBe("Owner"));
    expect(result.current.staffMemberId).toBe(STAFF_ID);
    // …and Sam's sales attach to it.
    await waitFor(() => expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001"));
  });

  it("no open shift: the server returns none, and that is a known answer", async () => {
    get.mockResolvedValue({ shifts: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.shift).toBeNull();
  });

  it("switching account on the tablet reuses the shift already known — no 'No shift' flash, no refetch", async () => {
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
    await waitFor(() => expect(result.current.known).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);

    // Owner steps away, another cashier signs in on the same device.
    act(() => {
      session({ staffId: "clstaff000000000000000002", staffName: "Alex" });
    });

    expect(result.current.known).toBe(true);
    expect(result.current.shift?.id).toBe("clshift000000000000000001");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("points the POS session at a shift opened after login, so sales attach to it", async () => {
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001"));
  });

  it("unlinks a session shift that was closed elsewhere", async () => {
    session({ shiftId: "clshift000000000000000001" });
    get.mockResolvedValue({ shifts: [] });
    const { wrapper } = setup();
    renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(usePosSession.getState().shiftId).toBeNull());
  });

  it("does NOT unlink the session on a failed read — unknown is not 'closed'", async () => {
    session({ shiftId: "clshift000000000000000001" });
    get.mockRejectedValue(new Error("offline"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.known).toBe(false);
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
  });

  it("kitchen holds no till: not allowed and no request made", async () => {
    session({ staffRole: "KITCHEN", allowedPages: ["/pos/kds"] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    expect(result.current.allowed).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("a persona from another store is not allowed here", () => {
    session({ storeId: "other-store" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
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
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.staffMemberId).toBe(OWNER_ROW_ID));
    // The owner row is who they would OPEN a shift as — it does not narrow the read.
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/stores/s1/shifts", { status: "open", take: "1" })
    );
  });

  it("an owner with no OWNER staff row has nothing to open a shift as — but still sees the store's", async () => {
    session({ staffId: "owner", staffName: "Owner", staffRole: "OWNER", allowedPages: null });
    get.mockImplementation(async (url: string) =>
      url === "/stores/s1/staff"
        ? { staff: [{ id: STAFF_ID, role: "CASHIER", isActive: true }] }
        : { shifts: [shiftRow()] }
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.staffMemberId).toBeNull();
    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));
  });
});

describe("opening and closing keep the session honest", () => {
  it("opening a shift links the session and is not undone by the stale 'no shift' read", async () => {
    get.mockResolvedValueOnce({ shifts: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ mine: useActiveShift("s1"), open: useOpenShift("s1") }), {
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
    const { result } = renderHook(() => ({ mine: useActiveShift("s1"), close: useCloseShift("s1") }), {
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

// These advance TIME. The earlier suite never did, so deleting `refetchInterval` (the poll
// that lets one tablet learn another closed the shift) left every test green.
describe("useActiveShift over time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every minute, so another tablet's open or close arrives without navigating", async () => {
    // shouldAdvanceTime keeps real time flowing so waitFor still works.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get.mockResolvedValueOnce({ shifts: [] }).mockResolvedValue({ shifts: [shiftRow()] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.shift).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);

    // Before a minute has passed: nothing new.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(get).toHaveBeenCalledTimes(1);

    // The owner opened a shift on another tablet in the meantime.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));
    expect(get).toHaveBeenCalledTimes(2);
    // …and this tablet's sales now attach to it.
    await waitFor(() => expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001"));
  });

  it("one failed poll keeps the last-known shift — 'unknown' is not 'closed' and not 'gone'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    session({ shiftId: "clshift000000000000000001" });
    get.mockResolvedValueOnce({ shifts: [shiftRow()] }).mockRejectedValue(new Error("offline"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The hook says a read failed AND that it still has an answer. The Shift page relies
    // on exactly this pair to keep the Finish screen up instead of the error card.
    expect(result.current.known).toBe(true);
    expect(result.current.shift?.id).toBe("clshift000000000000000001");
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
  });

  // The race the static review reproduced. The cache has no persona in its key, so it can
  // predate a shift another tablet opened; a persona then signs in and verify-pin (fresher
  // than the cache) hands them that shift. Reconciling from the stale cache used to
  // overwrite it with "no shift" and leave their sales unlinked until the next poll.
  it("a persona's login is not overwritten by a cached 'no shift' that predates it", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-20T10:00:00Z") });
    get.mockResolvedValueOnce({ shifts: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.shift).toBeNull();

    // Five seconds later the owner opens a shift elsewhere; this tablet's cashier signs in
    // and the server's verify-pin answer carries it.
    vi.setSystemTime(new Date("2026-09-20T10:00:05Z"));
    get.mockResolvedValue({ shifts: [shiftRow()] });
    const seen: Array<string | null> = [];
    const unsubscribe = usePosSession.subscribe((state) => seen.push(state.shiftId));
    act(() => {
      usePosSession.getState().login({
        storeId: "s1",
        staffId: STAFF_ID,
        staffName: "Sam",
        staffRole: "CASHIER",
        shiftId: "clshift000000000000000001",
        allowedPages: ["/pos", "/pos/orders"],
      });
    });

    // It asks again instead of trusting the older answer, and lands on the same shift.
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.shift?.id).toBe("clshift000000000000000001"));
    unsubscribe();
    expect(usePosSession.getState().shiftId).toBe("clshift000000000000000001");
    // Never dipped to null on the way — that dip is the bug (sales go unlinked).
    expect(seen.filter((id) => id === null)).toEqual([]);
  });

  it("…but a fresh 'no shift' after the login IS believed (the shift really was closed)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-20T10:00:00Z") });
    get.mockResolvedValue({ shifts: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActiveShift("s1"), { wrapper });
    await waitFor(() => expect(result.current.known).toBe(true));

    vi.setSystemTime(new Date("2026-09-20T10:00:05Z"));
    act(() => {
      usePosSession.getState().login({
        storeId: "s1",
        staffId: STAFF_ID,
        staffName: "Sam",
        staffRole: "CASHIER",
        shiftId: "clshift000000000000000001",
        allowedPages: ["/pos", "/pos/orders"],
      });
    });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(usePosSession.getState().shiftId).toBeNull());
  });
});
