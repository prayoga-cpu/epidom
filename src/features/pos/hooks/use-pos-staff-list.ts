import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface PosStaffListItem {
  id: string;
  name: string;
  isActive: boolean;
}

/** Store staff roster for filter dropdowns (Order Queue / History "cashier" filter). */
export function usePosStaffList(storeId: string) {
  return useQuery({
    queryKey: ["pos", "staff-list", storeId],
    queryFn: async () => {
      const res = await apiClient.get<{ staff: PosStaffListItem[] }>(`/stores/${storeId}/staff`);
      return res.staff;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}
