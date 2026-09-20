import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CloseShiftInput, OpenShiftInput } from "@/lib/validation/operations.schemas";
import type { ShiftReportData } from "@/lib/finance/shift-report";
import { canManageShift } from "../lib/shift-access";
import { OWNER_PERSONA_ID, usePosSession } from "./use-pos-session";

/**
 * The store's till session (`Shift`) — the one Shift page, the status-bar chip
 * and checkout all care about.
 *
 * A till belongs to the STORE, not to whoever opened it: one is open at a time
 * (the server refuses a second), and every persona on every device signed in to
 * the store sees the same one. `staffMember` is who STARTED it, shown as such —
 * a cashier picking up at handover sees the owner's shift, not "no shift".
 *
 * NOT `ScheduleShift` (a roster block) and not the time-window "filter by
 * shift" of Order History: this is the drawer someone counted a float into.
 * See project_shift_window_semantics.
 */

export interface TillShift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  /** Prisma `Decimal` crosses JSON as a string — `Number(...)` before arithmetic. */
  openingCash: string | number;
  closingCash: string | number | null;
  /** Who opened it. Not necessarily the persona looking at it. */
  staffMember: { id: string; name: string; role: string } | null;
}

export interface ShiftReportResponse {
  report: ShiftReportData;
  /** Cashier who ran the till session. */
  shiftLabel: string | null;
  storeName: string;
  /** ISO 4217 the store's amounts are literally denominated in — no conversion. */
  currency: string;
}

/**
 * The `StaffMember` id a till session is attributed to for the current persona.
 *
 * A staff persona is its own row. The account owner working the till has no
 * persona row (PosStaffGate logs them in as the literal "owner"), but every
 * store has an auto-created OWNER-role staff member that exists precisely so
 * the owner's shifts have someone to belong to — resolved here from the roster.
 */
export function useShiftStaffMemberId(storeId: string) {
  const staffId = usePosSession((s) => s.staffId);
  const isOwnerPersona = staffId === OWNER_PERSONA_ID;

  const ownerRow = useQuery({
    queryKey: ["pos", "owner-staff-member", storeId],
    queryFn: async () => {
      const res = await apiClient.get<{
        staff: Array<{ id: string; role: string; isActive: boolean }>;
      }>(`/stores/${storeId}/staff`);
      return res.staff.find((s) => s.role === "OWNER" && s.isActive)?.id ?? null;
    },
    enabled: isOwnerPersona && !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    staffMemberId: isOwnerPersona ? (ownerRow.data ?? null) : staffId,
    isResolving: isOwnerPersona && ownerRow.isLoading,
  };
}

/** Every cache a till opening or closing makes stale. */
function invalidateShiftCaches(queryClient: ReturnType<typeof useQueryClient>, storeId: string) {
  queryClient.invalidateQueries({ queryKey: ["pos", "active-shift", storeId] });
  // The Shift page's history: a shift that has just ended belongs at the top of it.
  queryClient.invalidateQueries({ queryKey: ["pos", "shift-history", storeId] });
  // The "filter by shift" pickers on Order History and Finance list sessions.
  queryClient.invalidateQueries({ queryKey: ["pos", "store-shifts", storeId] });
  // Dashboard operations card: open tills and their live expected cash.
  queryClient.invalidateQueries({ queryKey: ["operations-status", storeId] });
  queryClient.invalidateQueries({ queryKey: ["finance-cash-reconciliation", storeId] });
  // My Schedule's history list shows the till open/close events.
  queryClient.invalidateQueries({ queryKey: ["schedule-my-log", storeId] });
}

/**
 * The store's open shift, or null when there is none — the same answer for every
 * persona and device signed in to the store (see the note at the top of the file).
 *
 * Also the one place that keeps `usePosSession().shiftId` truthful. That field
 * used to be written only at PIN login, so a till opened afterwards left every
 * later sale unattached to it (its cash then missing from the drawer's expected
 * total), and a till closed afterwards kept attaching sales to a session that
 * had already been signed off. Mounted by the status bar on every POS route, so
 * the session is corrected wherever the cashier happens to be.
 *
 * `staffMemberId` is who the CURRENT persona is as a `StaffMember` — what they
 * would open a shift or record a cash movement as. It plays no part in which
 * shift is returned.
 */
export function useActiveShift(storeId: string) {
  const session = usePosSession();
  const { staffMemberId, isResolving } = useShiftStaffMemberId(storeId);
  const setShiftId = usePosSession((s) => s.setShiftId);

  const allowed =
    session.isActive &&
    session.storeId === storeId &&
    canManageShift({ staffRole: session.staffRole, allowedPages: session.allowedPages });

  const query = useQuery({
    // No persona in the key on purpose: switching account on this tablet reuses the
    // answer already in the cache instead of flashing "No shift" while it refetches.
    queryKey: ["pos", "active-shift", storeId],
    queryFn: async () => {
      // Filtered on the server: the newest row of the store is usually a CLOSED
      // shift, so `take: 1` alone could hide an open one behind it. Newest open
      // first — one is enforced on POST, but shifts opened per-person before that
      // rule can still overlap, and the newest is the one sales attach to; closing
      // it surfaces the next.
      const res = await apiClient.get<{ shifts: TillShift[] }>(`/stores/${storeId}/shifts`, {
        status: "open",
        take: "1",
      });
      return res.shifts[0] ?? null;
    },
    enabled: allowed,
    staleTime: 30 * 1000,
    // The shift is opened and closed from other tablets and accounts, and nothing
    // pushes that here — without a poll a device shows "No shift" until someone
    // navigates. Cheap (one row) and paused while the tab is hidden.
    refetchInterval: 60 * 1000,
  });

  const shift = query.data ?? null;
  const sessionShiftId = session.shiftId;
  // When this persona signed in. Login carries the shift the SERVER just resolved
  // (verify-pin), which is fresher than anything already in this shared cache.
  const loginAt = session.pinVerifiedAt ?? 0;
  const { isSuccess, dataUpdatedAt, refetch } = query;
  useEffect(() => {
    // Only on a settled answer — a loading or failed query is "unknown", and
    // unlinking the session on unknown would drop the till mid-sale.
    if (!isSuccess) return;
    // The cached answer is OLDER than this login. The key has no persona in it, so
    // after an account switch the cache can predate a shift another tablet opened
    // since; applying it would overwrite the login's shift with "no shift" and leave
    // sales unlinked until the next poll. Ask again and reconcile from that instead.
    if (dataUpdatedAt < loginAt) {
      void refetch({ cancelRefetch: false });
      return;
    }
    const next = shift?.id ?? null;
    if (next !== sessionShiftId) setShiftId(next);
  }, [isSuccess, dataUpdatedAt, loginAt, shift?.id, sessionShiftId, setShiftId, refetch]);

  return {
    shift,
    /** False for a role/persona that can't hold a till (kitchen, no persona). */
    allowed,
    /**
     * Whether "no shift" is an answer rather than a gap. `shift` is null both
     * when there is none and while nothing has been fetched (or the device is
     * offline with no cached answer) — a label that says "No shift" must only
     * follow the first. Last-known data still counts after a failed refetch.
     */
    known: query.data !== undefined,
    staffMemberId,
    isLoading: allowed && (isResolving || query.isLoading),
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useOpenShift(storeId: string) {
  const queryClient = useQueryClient();
  const setShiftId = usePosSession((s) => s.setShiftId);

  return useMutation({
    mutationFn: (body: OpenShiftInput) =>
      apiClient.post<{ shift: TillShift }>(`/stores/${storeId}/shifts`, body),
    onSuccess: ({ shift }) => {
      // Seed the cache with the row the server just returned BEFORE pointing the
      // session at it: useActiveShift reconciles session.shiftId against that query,
      // and a stale "no shift" there would unlink the till the moment it opened.
      queryClient.setQueryData(["pos", "active-shift", storeId], shift);
      setShiftId(shift.id);
      invalidateShiftCaches(queryClient, storeId);
    },
    // A 409 means the store already has a till open — someone else opened it, on
    // this device or another. Re-read rather than leave a form offering to open a
    // second one; the page flips to the shift that is running.
    onError: () => invalidateShiftCaches(queryClient, storeId),
  });
}

export function useCloseShift(storeId: string) {
  const queryClient = useQueryClient();
  const setShiftId = usePosSession((s) => s.setShiftId);

  return useMutation({
    mutationFn: ({ shiftId, ...body }: CloseShiftInput & { shiftId: string }) =>
      apiClient.patch<{ shift: TillShift }>(`/stores/${storeId}/shifts/${shiftId}`, body),
    onSuccess: (_result, { shiftId }) => {
      // Same reason as opening, in reverse: clear the cached open shift first, or
      // useActiveShift would read it back and re-attach the session to a till that
      // has just been signed off, until the refetch lands.
      queryClient.setQueriesData<TillShift | null>(
        { queryKey: ["pos", "active-shift", storeId] },
        (old) => (old?.id === shiftId ? null : old)
      );
      // Before the next sale, not after: anything rung up from here on must not
      // attach to a signed-off till.
      setShiftId(null);
      invalidateShiftCaches(queryClient, storeId);
    },
    // A 409 means it was already closed elsewhere. Re-read so the page shows the
    // real state instead of a Finish screen for a till that no longer exists.
    onError: () => invalidateShiftCaches(queryClient, storeId),
  });
}

/**
 * The shift report for one till session, computed live by the server — the
 * cash-drawer block (expected cash, every category) and the payment-method
 * split the Finish Shift screen is built from. Same service as the printed and
 * browser report, so this screen can't disagree with the paper.
 */
export function useShiftReport(
  storeId: string,
  shiftId: string | null,
  options: { enabled?: boolean; refetchInterval?: number | false } = {}
) {
  return useQuery({
    queryKey: ["pos", "shift-report", storeId, shiftId],
    queryFn: () =>
      apiClient.get<ShiftReportResponse>(`/stores/${storeId}/reports/shift-report`, {
        shiftId: shiftId!,
      }),
    enabled: !!shiftId && (options.enabled ?? true),
    // Money on screen must not be a cached guess — new orders keep arriving
    // from other tablets and the storefront while this is open.
    staleTime: 0,
    gcTime: 0,
    refetchInterval: options.refetchInterval ?? false,
  });
}
