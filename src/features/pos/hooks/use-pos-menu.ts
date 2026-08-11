import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PosMenuCategory } from "../types/pos.types";
import { apiClient } from "@/lib/api/client";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

interface PosMenuData {
  categories: PosMenuCategory[];
  total: number;
  // The optional second product line (Product.productLine — e.g. a
  // restaurant's hair-salon add-on) — items are folded into `categories`
  // above (tagged department: "CUSTOM"), these two just drive the extra
  // PosDepartmentBar pill's visibility/label.
  customProductsEnabled: boolean;
  customProductsLabel: string | null;
}

export function usePosMenu(storeId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pos", "menu", storeId],
    queryFn: async () => {
      return apiClient.get<PosMenuData>(`/stores/${storeId}/pos/menu`);
    },
    enabled: !!storeId,
    // Prices, availability, and options can be edited from Data/Menu Editor
    // in a different tab/device while the cashier has this screen open — a
    // long staleTime would leave POS silently serving a stale menu. Polling
    // (same pattern as useMaterials) keeps it self-healing; the Pusher push
    // below (when configured) makes the common case near-instant instead of
    // waiting on the poll, which exists purely as a safety net.
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });

  useRealtimeChannel(storeId, {
    [REALTIME_EVENTS.MENU_CHANGED]: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "menu", storeId] });
    },
    [REALTIME_EVENTS.PRODUCT_CHANGED]: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "menu", storeId] });
    },
  });

  return query;
}
