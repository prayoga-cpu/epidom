"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import type { CustomerListDto } from "@/types/api/cashier";
import { useCustomerFormatters } from "../hooks/use-customer-formatters";

interface CustomersSummaryProps {
  loyaltyEnabled: boolean;
  /** True until BOTH the loyalty setting and the summary request have settled. */
  isLoading: boolean;
  summary: CustomerListDto["summary"];
  /** Store-wide customer count (the unfiltered list), used when loyalty is off. */
  totalCount: number | undefined;
}

function TileSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-1">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

/**
 * Store-wide tiles — they come from an unfiltered request, so they hold still
 * while the owner searches. Members / non-members / points redeemed only mean
 * something with a loyalty program, so without one the row collapses to a single
 * "Total customers" tile rather than three zeros.
 */
export function CustomersSummary({
  loyaltyEnabled,
  isLoading,
  summary,
  totalCount,
}: CustomersSummaryProps) {
  const { t } = useI18n();
  const fmt = useCustomerFormatters();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden="true">
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
      </div>
    );
  }

  if (loyaltyEnabled && summary) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("customers.summary.members")} value={fmt.number(summary.members)} />
        <StatCard
          label={t("customers.summary.nonMembers")}
          value={fmt.number(summary.nonMembers)}
        />
        <StatCard
          label={t("customers.summary.pointsRedeemed")}
          value={fmt.number(summary.pointsRedeemedTotal)}
        />
      </div>
    );
  }

  // Loyalty off (or the summary request failed): the plain count is still true
  // and useful, and it's all we can say. Nothing renders if we don't have it.
  if (totalCount === undefined) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label={t("customers.summary.total")} value={fmt.number(totalCount)} />
    </div>
  );
}
