import { useQuery } from "@tanstack/react-query";
import type { PosMenuCategory } from "../types/pos.types";
import { apiClient } from "@/lib/api/client";

interface PosMenuData {
  categories: PosMenuCategory[];
  total: number;
}

export function usePosMenu(storeId: string) {
  return useQuery({
    queryKey: ["pos", "menu", storeId],
    queryFn: async () => {
      return apiClient.get<PosMenuData>(`/stores/${storeId}/pos/menu`);
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
