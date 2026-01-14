import { useQuery } from "@tanstack/react-query";

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
      const json = await response.json();
      // API returns { success: true, data: { alerts: [...] } }
      // We need to extract the data property
      return json.data as AlertsResponse;
    },
    enabled: !!storeId,
    initialData,
    // ✅ Mark initial data as fresh so React Query won't immediately refetch
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    // Real-time configuration: Critical data - faster polling
    staleTime: 30 * 1000, // 30 seconds - data considered fresh (increased from 10s)
    refetchInterval: 60 * 1000, // Poll every 60 seconds (reduced from 15s for stability)
    refetchIntervalInBackground: false, // Don't poll when tab is not active
    refetchOnMount: false, // Don't refetch if data is fresh (within staleTime)
    refetchOnWindowFocus: false, // Don't refetch on focus to prevent badge flicker
    gcTime: 5 * 60 * 1000, // Keep data in cache for 5 minutes
  });
}

