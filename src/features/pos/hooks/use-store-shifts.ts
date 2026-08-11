import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface StoreShiftListItem {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string | number;
  closingCash: string | number | null;
  staffMember: { id: string; name: string; role: string } | null;
}

/**
 * Recent till sessions (`Shift`) for the "filter by shift" pickers on Order
 * History and Finance. Every row carries `openedAt`/`closedAt`, so the picker
 * can resolve a session to its time window client-side (see
 * lib/finance/shift-window.ts) and pass it through the existing `from`/`to`
 * params — no per-consumer API change needed.
 *
 * 100 is the route's own ceiling; a store runs at most a handful of till
 * sessions a day, so this comfortably covers "the shift I want to report on".
 */
export function useStoreShifts(storeId: string, enabled = true) {
  return useQuery({
    queryKey: ["pos", "store-shifts", storeId],
    queryFn: async () => {
      const res = await apiClient.get<{ shifts: StoreShiftListItem[]; total: number }>(
        `/stores/${storeId}/shifts?take=100`
      );
      return res.shifts;
    },
    enabled: !!storeId && enabled,
    staleTime: 60 * 1000,
  });
}
