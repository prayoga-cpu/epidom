"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { ProductionBatchWithRelations } from "../recipe-production/hooks/use-production-batches";
import { Package, Star, TrendingUp, AlertCircle } from "lucide-react";

interface ProductionMetricsCardsProps {
  batches: ProductionBatchWithRelations[];
}

export function ProductionMetricsCards({ batches }: ProductionMetricsCardsProps) {
  const { t } = useI18n();

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalBatches = batches.length;
    const completedBatches = batches.filter((b) => b.status === "COMPLETED");
    const inProgressBatches = batches.filter(
      (b) => b.status === "IN_PROGRESS" || b.status === "PLANNED"
    );
    const cancelledBatches = batches.filter((b) => b.status === "CANCELLED");

    // Calculate production efficiency (actual vs planned quantity)
    const efficiency =
      completedBatches.length > 0
        ? (completedBatches.reduce((sum, b) => sum + Number(b.actualQuantity || 0), 0) /
            completedBatches.reduce((sum, b) => sum + Number(b.plannedQuantity), 0)) *
          100
        : 0;

    // Calculate total output
    const totalOutput = batches.reduce((sum, b) => sum + Number(b.actualQuantity || 0), 0);

    return {
      totalBatches,
      completedBatches: completedBatches.length,
      inProgressBatches: inProgressBatches.length,
      cancelledBatches: cancelledBatches.length,
      efficiency,
      totalOutput,
    };
  }, [batches]);

  const cards = [
    {
      title: t("management.productionHistory.metrics.totalBatches"),
      value: metrics.totalBatches,
      icon: Package,
      iconColor: "text-gray-700 dark:text-gray-300",
      bgColor: "bg-gray-200 dark:bg-gray-700",
      description: t("management.productionHistory.metrics.totalBatchesDescription"),
    },
    {
      title: t("management.productionHistory.metrics.completedBatches"),
      value: metrics.completedBatches,
      icon: Star,
      iconColor: "text-gray-700 dark:text-gray-300",
      bgColor: "bg-gray-200 dark:bg-gray-700",
      description: t("management.productionHistory.metrics.completedBatchesDescription"),
    },
    {
      title: t("management.productionHistory.metrics.efficiency"),
      value: metrics.efficiency.toFixed(1),
      suffix: "%",
      icon: TrendingUp,
      iconColor: "text-gray-700 dark:text-gray-300",
      bgColor: "bg-gray-200 dark:bg-gray-700",
      description: t("management.productionHistory.metrics.efficiencyDescription"),
    },
    {
      title: t("management.productionHistory.metrics.totalOutput"),
      value: metrics.totalOutput,
      suffix: ` ${t("management.productionHistory.metrics.units")}`,
      icon: Package,
      iconColor: "text-gray-700 dark:text-gray-300",
      bgColor: "bg-gray-200 dark:bg-gray-700",
      description: t("management.productionHistory.metrics.totalOutputDescription"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="shadow-sm">
            <CardContent className="p-4 md:p-6">
              {/* Mobile: Center-aligned with icon below */}
              <div className="flex flex-col items-center space-y-3 text-center md:hidden">
                <div className="w-full space-y-2">
                  <p className="text-muted-foreground text-xs font-medium">{card.title}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <p className="text-2xl leading-none font-bold">{card.value}</p>
                    {card.suffix && (
                      <p className="text-muted-foreground text-sm leading-none font-semibold">
                        {card.suffix}
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </div>

              {/* Tablet/Desktop: Left-aligned with icon on the right */}
              <div className="hidden md:flex md:items-start md:justify-between md:gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-muted-foreground text-sm font-medium">{card.title}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl leading-none font-bold">{card.value}</p>
                    {card.suffix && (
                      <p className="text-muted-foreground text-base leading-none font-semibold">
                        {card.suffix}
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-tight">{card.description}</p>
                </div>
                <div className={`shrink-0 rounded-lg p-2.5 ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
