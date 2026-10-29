import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { planHasFeature } from "@/lib/plans/entitlements";

/**
 * Whether this store's plan includes the Claude connector, for UI hints only
 * (the "Do it in Claude" line on the Data page). Same source as the other
 * client plan checks: the store owner's subscription, ACTIVE or it counts as
 * FREE. Unknown (loading, failed) reads as no: it only hides a hint, and
 * /api/mcp enforces the plan itself.
 */
export function useClaudeConnectorAccess(): boolean {
  const { data } = useSubscriptionStatus();
  const subscription = data?.subscription;
  return (
    !!subscription &&
    subscription.status === "ACTIVE" &&
    planHasFeature(subscription.plan, "claudeConnector")
  );
}
