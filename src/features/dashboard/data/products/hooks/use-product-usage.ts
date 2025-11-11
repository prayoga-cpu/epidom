"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Product usage response type
 */
export interface ProductUsageResponse {
  current: number;
  limit: number | null; // null means unlimited (PRO/ENTERPRISE plans)
  canCreateMore: boolean;
}

/**
 * Custom hook to fetch product usage for a store
 *
 * Returns product usage information including:
 * - Current product count
 * - Limit based on subscription plan
 * - Whether user can create more products
 *
 * Used in product components to conditionally render create button and show limits.
 *
 * @param storeId - Store ID to check product usage for
 * @returns Product usage data with loading and error states
 */
export function useProductUsage(storeId: string) {
  return useQuery<ProductUsageResponse>({
    queryKey: ["product-usage", storeId],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/product-usage`);

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, return default values
          return {
            current: 0,
            limit: 0,
            canCreateMore: false,
          };
        }
        throw new Error("Failed to fetch product usage");
      }

      const data = await response.json();
      return data;
    },
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on mount if data exists
  });
}

