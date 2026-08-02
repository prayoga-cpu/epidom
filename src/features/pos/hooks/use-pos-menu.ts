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
    // Prices, availability, and options can be edited from Data/Menu Editor
    // in a different tab/device while the cashier has this screen open — a
    // long staleTime would leave POS silently serving a stale menu. Polling
    // (same pattern as useMaterials) keeps it self-healing without needing
    // a full realtime/WebSocket setup; mutations that touch the menu also
    // invalidate this key directly for instant same-tab feedback.
    staleTime: 3 * 1000,
    refetchInterval: 5 * 1000,
  });
}
