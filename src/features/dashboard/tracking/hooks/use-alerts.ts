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
    phone: string | null;
  }>;
  createdAt: string;
}

export interface AlertsResponse {
  alerts: Alert[];
}

// Query keys
export const alertKeys = {
  all: ["alerts"] as const,
  lists: (storeId: string) => [...alertKeys.all, "list", storeId] as const,
};

/**
 * Hook to fetch alerts for a store
 * Real-time enabled: Critical data - polls every 15 seconds when tab is active
 */
export function useAlerts(storeId: string, initialData?: AlertsResponse) {
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
    initialData, // ✅ Accept initial data from Server Component
    // Real-time configuration: Critical data - faster polling
    staleTime: 10 * 1000, // 10 seconds - data considered fresh
    refetchInterval: 15 * 1000, // Poll every 15 seconds (critical data)
    refetchIntervalInBackground: true, // Poll even when tab is not active (critical)
    refetchOnMount: false, // Don't refetch if data is fresh (within staleTime)
    refetchOnWindowFocus: true, // Always refetch on focus for critical data
    meta: {
      refetchInterval: 15 * 1000, // Store in meta for smart polling
    },
  });
}
