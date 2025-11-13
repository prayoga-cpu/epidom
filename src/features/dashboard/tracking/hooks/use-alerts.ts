import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { fetchJson } from "@/lib/api/client";

export interface Alert {
  id: string;
  type: "LOW_STOCK";
  severity: "critical" | "warning";
  materialId: string;
  materialName: string;
  materialSku: string;
  currentStock: number;
  minStock: number;
  unit: string;
  stockPercentage: number;
  suppliers: Array<{
    id: string;
    name: string;
    price: number;
    isPreferred: boolean;
  }>;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
}

// Query Key Factory
export const alertKeys = {
  all: ["alerts"] as const,
  lists: (storeId: string) => [...alertKeys.all, "list", storeId] as const,
  list: (storeId: string) => alertKeys.lists(storeId), // Alias for consistency
};

/**
 * Hook to fetch alerts for a store
 */
export function useAlerts(storeId: string) {
  return useQuery<AlertsResponse>({
    queryKey: alertKeys.list(storeId),
    queryFn: () => fetchJson<AlertsResponse>(`/api/stores/${storeId}/alerts`),
    enabled: !!storeId,
    ...DEFAULT_QUERY_OPTIONS.realTime,
  });
}
