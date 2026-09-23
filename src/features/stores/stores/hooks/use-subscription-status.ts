"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

/**
 * Subscription plan type
 */
export type SubscriptionPlan = "FREE" | "FREE" | "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";

/**
 * Subscription status type
 */
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";

/**
 * Subscription status response type
 */
export interface SubscriptionStatusResponse {
  hasSubscription: boolean;
  subscription: {
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    isTrialing: boolean;
    cancelAtPeriodEnd: boolean;
    canManagePayment: boolean;
    canCancel: boolean;
    isBeta: boolean;
    customPriceAmount: number | null;
    customPriceCurrency: string | null;
    customPriceInterval: "MONTHLY" | "YEARLY" | null;
    customPricePlan: SubscriptionPlan | null;
    /** Quoted by an admin but not yet paid — access is suspended until it is. */
    customPricePending: boolean;
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
  // Inside a store, the plan that applies is the STORE'S (its owner's) — which
  // for the owner is their own subscription, and for a linked staff account
  // (no subscription of its own) is the only correct answer. Outside a store
  // (/stores, pricing, ...) there is no store to scope to and the account's
  // own subscription is what's meant, as before.
  const params = useParams<{ storeId?: string }>();
  const storeId = params?.storeId;

  return useQuery<SubscriptionStatusResponse>({
    queryKey: ["subscription-status", storeId ?? null],
    queryFn: async () => {
      const response = await fetch(
        storeId
          ? `/api/subscriptions/status?storeId=${encodeURIComponent(storeId)}`
          : "/api/subscriptions/status"
      );

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

      const responseData = await response.json();
      // API response is wrapped in { success: true, data: {...} }
      // Extract the actual data from the response
      return responseData.success === true ? responseData.data : responseData;
    },
    retry: false,
  });
}
