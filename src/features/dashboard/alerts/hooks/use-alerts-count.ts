import { useAlerts } from "@/features/dashboard/tracking/hooks/use-alerts";
import { useParams } from "next/navigation";

/**
 * Custom hook to get alerts count
 * Returns the number of active alerts
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

  const { data } = useAlerts(storeId);

  return data?.alerts?.length || 0;
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
