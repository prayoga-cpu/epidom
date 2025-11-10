"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Subscription status response type
 */
interface SubscriptionStatusResponse {
  hasSubscription: boolean;
  subscription: {
    id: string;
    plan: "STARTER" | "PRO" | "ENTERPRISE";
    status: "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  storeUsage: {
    current: number;
    limit: number;
    canCreateMore: boolean;
  } | null;
}

/**
 * Custom hook to fetch subscription status
 *
 * Returns subscription status, store usage, and whether user can create stores.
 * Used in StoresContainer to conditionally render create store button.
 *
 * @returns Subscription status data with loading and error states
 */
export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatusResponse>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions/status");

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, return no subscription
          return {
            hasSubscription: false,
            subscription: null,
            storeUsage: null,
          };
        }
        throw new Error("Failed to fetch subscription status");
      }

      const data = await response.json();
      return data;
    },
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });
}

