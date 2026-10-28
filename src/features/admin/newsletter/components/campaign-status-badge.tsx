import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isOverdue, type CampaignSummary } from "../lib/campaign-display";

const STYLES = {
  DRAFT: { label: "Draft", className: "" },
  SCHEDULED: {
    label: "Scheduled",
    className: "border-blue-500/40 text-blue-700 dark:text-blue-300",
  },
  SENDING: {
    label: "Sending…",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  },
  SENT: { label: "Sent", className: "border-green-500/40 text-green-700 dark:text-green-300" },
  FAILED: { label: "Failed", className: "border-red-500/40 text-red-700 dark:text-red-300" },
  OVERDUE: { label: "Overdue", className: "border-red-500/40 text-red-700 dark:text-red-300" },
} as const;

export function CampaignStatusBadge({
  campaign,
  now = new Date(),
}: {
  campaign: Pick<CampaignSummary, "status" | "scheduledAt">;
  now?: Date;
}) {
  const style = STYLES[isOverdue(campaign, now) ? "OVERDUE" : campaign.status];
  return (
    <Badge variant="outline" className={cn("text-xs", style.className)}>
      {style.label}
    </Badge>
  );
}
