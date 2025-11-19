import { DashboardCard } from "./dashboard-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";

export function ChartSkeleton() {
  const { t } = useI18n();

  const cardContent = (
    <div className="flex h-[300px] w-full flex-col space-y-3 p-4">
      {/* Chart title area */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Chart bars skeleton */}
      <div className="flex flex-1 items-end justify-around gap-2 pt-4">
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>

      {/* X-axis line */}
      <Skeleton className="h-px w-full" />
    </div>
  );

  return (
    <DashboardCard
      cardTitle={t("dashboard.productionHistory.title")}
      cardDescription={t("dashboard.productionHistory.description")}
      cardContent={cardContent}
    />
  );
}
