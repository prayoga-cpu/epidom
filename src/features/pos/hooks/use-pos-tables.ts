import { useQuery } from "@tanstack/react-query";
import type { TableStatus } from "@prisma/client";
import { apiClient } from "@/lib/api/client";

/** The fields of GET /stores/[id]/tables the till's table picker reads. */
export interface PosTableOption {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
}

/**
 * The store's registered tables (the Tables page), for picking one on a sale.
 * Same query key and endpoint as the Tables page, so the two share one cache and
 * a table seated there shows up here without a second request.
 */
export function usePosTables(storeId: string, enabled = true) {
  return useQuery({
    queryKey: ["tables", storeId],
    queryFn: () => apiClient.get<PosTableOption[]>(`/stores/${storeId}/tables`),
    enabled,
    staleTime: 3 * 1000,
  });
}
