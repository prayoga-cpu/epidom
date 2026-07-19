import { useParams } from "next/navigation";
import { useAlerts } from "@/features/dashboard/tracking/hooks/use-alerts";

/**
 * Custom hook to get alerts count
 * Returns the number of active alerts
 *
 * This hook:
 * 1. Uses the shared useAlerts hook to leverage React Query caching
 * 2. Actively fetches if no data exists in cache
 * 3. Stays in sync with any cache updates from AlertsClient or AlertsPrefetch
 *
 * @returns {number} Total count of alerts
 *
 * @example
 * const alertsCount = useAlertsCount();
 * // alertsCount = 3
 */
export function useAlertsCount(): number {
  const params = useParams();
  const storeId = params?.storeId as string;

  // Use the shared useAlerts hook - this shares cache with AlertsClient
  const { data } = useAlerts(storeId);

  return data?.alerts?.length ?? 0;
}

/**
 * Get alerts count synchronously (for server components)
 * Note: This is a placeholder for server-side usage
 *
 * @returns {number} Total count of alerts (0 for now, should be fetched server-side)
 */
export function getAlertsCount(): number {
  // For server components, this would need to be an async function
  // that fetches from the API or database directly
  return 0;
}
