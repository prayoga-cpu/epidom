import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/**
 * One finished till session, as the Shift page's history lists it.
 *
 * `cashDifference` / `expectedCash` are the figures frozen when the shift was
 * ended — what the cashier was told at close. The full report one tap away, and
 * the Back Office shift report, recompute the position live, so a movement
 * backdated into the window afterwards can make those two differ from this row.
 */
export interface ShiftHistoryItem {
  id: string;
  openedAt: string;
  closedAt: string | null;
  /** Prisma `Decimal` crosses JSON as a string — `Number(...)` before arithmetic. */
  openingCash: string | number;
  closingCash: string | number | null;
  expectedCash: string | number | null;
  cashDifference: string | number | null;
  notes: string | null;
  /** Who ran it. */
  staffMember: { id: string; name: string; role: string } | null;
  _count: { orders: number };
}

/**
 * The store's finished shifts, newest first — every staff member's, not just the
 * persona's, because the till is the store's (see useActiveShift). The open one
 * is the status card above, so it is excluded here (`status: closed`).
 *
 * `take` grows for "Show more"; the previous page stays on screen while the
 * larger one loads so the list doesn't collapse to a spinner and jump.
 */
export function useShiftHistory(storeId: string, take: number, enabled = true) {
  return useQuery({
    queryKey: ["pos", "shift-history", storeId, take],
    queryFn: () =>
      apiClient.get<{ shifts: ShiftHistoryItem[]; total: number }>(`/stores/${storeId}/shifts`, {
        status: "closed",
        take: String(take),
      }),
    enabled: !!storeId && enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
