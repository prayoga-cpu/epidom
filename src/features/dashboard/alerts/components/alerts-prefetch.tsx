"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { alertKeys, type AlertsResponse } from "@/features/dashboard/tracking/hooks/use-alerts";

/**
 * AlertsPrefetch Component
 *
 * This component prefetches alerts data at the layout level to ensure
 * the sidebar badge always has data, regardless of which page the user is on.
 *
 * It runs once on mount and populates the React Query cache.
 */
export function AlertsPrefetch() {
  const params = useParams();
  const storeId = params?.storeId as string;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!storeId) return;

    // Check if data already exists in cache
    const existingData = queryClient.getQueryData<AlertsResponse>(alertKeys.lists(storeId));

    // Only fetch if cache is empty
    if (!existingData) {
      queryClient.prefetchQuery({
        queryKey: alertKeys.lists(storeId),
        queryFn: async () => {
          const response = await fetch(`/api/stores/${storeId}/alerts`);
          if (!response.ok) {
            throw new Error("Failed to fetch alerts");
          }
          const json = await response.json();
          // API returns { success: true, data: { alerts: [...] } }
          return json.data as AlertsResponse;
        },
        staleTime: 30 * 1000, // Keep data fresh for 30 seconds
      });
    }
  }, [storeId, queryClient]);

  // This component renders nothing - it just prefetches data
  return null;
}
