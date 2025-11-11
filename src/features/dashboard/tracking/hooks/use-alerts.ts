import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

// Query keys
export const alertKeys = {
  all: ["alerts"] as const,
  lists: (storeId: string) => [...alertKeys.all, "list", storeId] as const,
};

/**
 * Hook to fetch alerts for a store
 */
export function useAlerts(storeId: string) {
  return useQuery<AlertsResponse>({
    queryKey: alertKeys.lists(storeId),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/alerts`);
      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }
      return response.json();
    },
    enabled: !!storeId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Auto-refetch every minute
  });
}
