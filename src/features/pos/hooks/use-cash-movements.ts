import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CashMovementType } from "@prisma/client";
import { apiClient } from "@/lib/api/client";
import type { CreateCashMovementInput } from "@/lib/validation/operations.schemas";

/**
 * The non-sale cash ledger (`CashMovement`) as react-query.
 *
 * Tips, float top-ups, paid-outs, safe drops and tip payouts — everything that
 * opens the drawer without ringing up an order. The arithmetic that turns
 * these rows into an expected drawer balance lives in lib/finance/cash-drawer.ts;
 * this is only the transport.
 */

export interface CashMovementRow {
  id: string;
  type: CashMovementType;
  /**
   * Prisma `Decimal`, which crosses JSON as a string — never assume a number
   * here, always `Number(...)` before doing arithmetic or formatting.
   */
  amount: string | number;
  reason: string | null;
  occurredAt: string;
  shiftId: string | null;
  /** Null when the row was recorded by the real owner rather than a staff persona. */
  staffMemberId: string | null;
  staffMember: { id: string; name: string } | null;
}

export interface CashMovementFilters {
  /** One till session. Omitted means "every movement in the window", including
   * the ones recorded with no till open — which the API accepts on purpose. */
  shiftId?: string;
  /** ISO-8601 with offset, matching cashMovementListQuerySchema. */
  from?: string;
  to?: string;
}

/**
 * Movements for one till session or time window, newest first (the route's own
 * ordering). Returns the whole envelope rather than just the rows so a caller
 * can tell "no movements" from "more than the 100-row page ceiling".
 */
export function useCashMovements(storeId: string, filters: CashMovementFilters = {}) {
  const { shiftId, from, to } = filters;

  return useQuery({
    // The window is part of the key, not just the shift: the same store can be
    // asked for "this till" and "today" at once, and they are different lists.
    // Invalidation below still matches on the ["pos", "cash-movements", storeId]
    // prefix, so every variant is refreshed by one recorded movement.
    queryKey: ["pos", "cash-movements", storeId, shiftId ?? null, from ?? null, to ?? null],
    queryFn: () =>
      apiClient.get<{ cashMovements: CashMovementRow[]; total: number }>(
        `/stores/${storeId}/cash-movements`,
        {
          ...(shiftId && { shiftId }),
          ...(from && { from }),
          ...(to && { to }),
        }
      ),
    enabled: !!storeId,
  });
}

/**
 * Records one movement. The server re-validates with the same
 * `createCashMovementSchema` the caller's form uses, so a client that forgets
 * the reason on an outbound type is rejected rather than silently accepted.
 */
export function useRecordCashMovement(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCashMovementInput) =>
      apiClient.post<{ cashMovement: CashMovementRow }>(`/stores/${storeId}/cash-movements`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "cash-movements", storeId] });
      // The dashboard operations card derives its live expected-cash figure
      // from these rows (see lib/services/cash-drawer.service.ts), so it is
      // stale the moment one is recorded.
      queryClient.invalidateQueries({ queryKey: ["operations-status", storeId] });
      // The Finance cash tab recomputes the per-category breakdown live, so it
      // is stale too. Prefix match: its key carries the date range and staff
      // filter, and every variant is affected.
      queryClient.invalidateQueries({ queryKey: ["finance-cash-reconciliation", storeId] });
      // Deliberately NOT invalidating the shift/daily report: it is a server
      // component (app/(app)/store/[storeId]/pos/orders/daily-report), not a
      // react-query cache, so it recomputes on its next request anyway. An
      // invalidate() on a key nothing registers would just read as coverage
      // this hook does not actually have.
    },
  });
}
