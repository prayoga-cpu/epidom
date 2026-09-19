import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { CloseShiftInput, OpenShiftInput } from "@/lib/validation/operations.schemas";
import type { ShiftReportData } from "@/lib/finance/shift-report";
import { canManageShift } from "../lib/shift-access";
import { OWNER_PERSONA_ID, usePosSession } from "./use-pos-session";

/**
 * The persona's own till session (`Shift`) — the one Shift page, the status-bar
 * chip and checkout all care about.
 *
 * NOT `ScheduleShift` (a roster block) and not the time-window "filter by
 * shift" of Order History: this is the till a named person opened with a
 * counted float and is accountable for at close. See
 * project_shift_window_semantics.
 */

export interface MyShift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  /** Prisma `Decimal` crosses JSON as a string — `Number(...)` before arithmetic. */
  openingCash: string | number;
  closingCash: string | number | null;
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
  queryClient.invalidateQueries({ queryKey: ["pos", "my-shift", storeId] });
  // The "filter by shift" pickers on Order History and Finance list sessions.
  queryClient.invalidateQueries({ queryKey: ["pos", "store-shifts", storeId] });
  // Dashboard operations card: open tills and their live expected cash.
  queryClient.invalidateQueries({ queryKey: ["operations-status", storeId] });
  queryClient.invalidateQueries({ queryKey: ["finance-cash-reconciliation", storeId] });
  // My Schedule's history list shows the till open/close events.
  queryClient.invalidateQueries({ queryKey: ["schedule-my-log", storeId] });
}

/**
 * The persona's open shift, or null when there is none.
 *
 * Also the one place that keeps `usePosSession().shiftId` truthful. That field
 * used to be written only at PIN login, so a till opened afterwards left every
 * later sale unattached to it (its cash then missing from the drawer's expected
 * total), and a till closed afterwards kept attaching sales to a session that
 * had already been signed off. Mounted by the status bar on every POS route, so
 * the session is corrected wherever the cashier happens to be.
 */
export function useMyShift(storeId: string) {
  const session = usePosSession();
  const { staffMemberId, isResolving } = useShiftStaffMemberId(storeId);
  const setShiftId = usePosSession((s) => s.setShiftId);

  const allowed =
    session.isActive &&
    session.storeId === storeId &&
    canManageShift({ staffRole: session.staffRole, allowedPages: session.allowedPages });

  const query = useQuery({
    queryKey: ["pos", "my-shift", storeId, staffMemberId],
    queryFn: async () => {
      // One open shift per staff member is enforced on POST, so the newest row
      // is the open one whenever there is one.
      const res = await apiClient.get<{ shifts: MyShift[] }>(`/stores/${storeId}/shifts`, {
        staffId: staffMemberId!,
        take: "1",
      });
      return res.shifts.find((s) => !s.closedAt) ?? null;
    },
    enabled: allowed && !!staffMemberId,
    staleTime: 30 * 1000,
  });

  const shift = query.data ?? null;
  const sessionShiftId = session.shiftId;
  useEffect(() => {
    // Only on a settled answer — a loading or failed query is "unknown", and
    // unlinking the session on unknown would drop the till mid-sale.
    if (!query.isSuccess) return;
    const next = shift?.id ?? null;
    if (next !== sessionShiftId) setShiftId(next);
  }, [query.isSuccess, shift?.id, sessionShiftId, setShiftId]);

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
      apiClient.post<{ shift: MyShift }>(`/stores/${storeId}/shifts`, body),
    onSuccess: ({ shift }) => {
      // Seed the cache with the row the server just returned BEFORE pointing the
      // session at it: useMyShift reconciles session.shiftId against that query,
      // and a stale "no shift" there would unlink the till the moment it opened.
      if (shift.staffMember) {
        queryClient.setQueryData(["pos", "my-shift", storeId, shift.staffMember.id], shift);
      }
      setShiftId(shift.id);
      invalidateShiftCaches(queryClient, storeId);
    },
    // A 409 means this persona already has a till open — opened on another
    // device. Re-read rather than leave a form offering to open a second one.
    onError: () => invalidateShiftCaches(queryClient, storeId),
  });
}

export function useCloseShift(storeId: string) {
  const queryClient = useQueryClient();
  const setShiftId = usePosSession((s) => s.setShiftId);

  return useMutation({
    mutationFn: ({ shiftId, ...body }: CloseShiftInput & { shiftId: string }) =>
      apiClient.patch<{ shift: MyShift }>(`/stores/${storeId}/shifts/${shiftId}`, body),
    onSuccess: (_result, { shiftId }) => {
      // Same reason as opening, in reverse: clear the cached open shift first, or
      // useMyShift would read it back and re-attach the session to a till that
      // has just been signed off, until the refetch lands.
      queryClient.setQueriesData<MyShift | null>(
        { queryKey: ["pos", "my-shift", storeId] },
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
