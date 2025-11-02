"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { ProductionBatch } from "@/types/entities";
import { Package, Star, TrendingUp, AlertCircle } from "lucide-react";

interface ProductionMetricsCardsProps {
  batches: ProductionBatch[];
}

export function ProductionMetricsCards({ batches }: ProductionMetricsCardsProps) {
  const { t } = useI18n();

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalBatches = batches.length;
    const completedBatches = batches.filter((b) => b.status === "completed");
    const inProgressBatches = batches.filter(
      (b) => b.status === "in_progress" || b.status === "quality_check" || b.status === "pending"
    );
    const failedBatches = batches.filter((b) => b.status === "failed");

    // Calculate average quality score (only for completed batches with scores)
    const batchesWithScores = completedBatches.filter((b) => b.qualityScore !== null);
    const avgQuality =
      batchesWithScores.length > 0
        ? batchesWithScores.reduce((sum, b) => sum + (b.qualityScore || 0), 0) /
          batchesWithScores.length
        : 0;

    // Calculate production efficiency (actual vs target quantity)
    const efficiency =
      completedBatches.length > 0
        ? (completedBatches.reduce((sum, b) => sum + b.quantityProduced, 0) /
            completedBatches.reduce((sum, b) => sum + b.quantityPlanned, 0)) *
          100
        : 0;

    // Calculate total output
    const totalOutput = batches.reduce((sum, b) => sum + b.quantityProduced, 0);

    return {
      totalBatches,
      inProgressBatches: inProgressBatches.length,
      failedBatches: failedBatches.length,
      avgQuality,
      efficiency,
      totalOutput,
    };
  }, [batches]);

  const cards = [
    {
      title: t("management.productionHistory.metrics.totalBatches"),
      value: metrics.totalBatches,
      icon: Package,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900",
      description: t("management.productionHistory.metrics.totalBatchesDescription"),
    },
    {
      title: t("management.productionHistory.metrics.averageQuality"),
      value: metrics.avgQuality.toFixed(1),
      suffix: ` ${t("common.of")} 10`,
      icon: Star,
      iconColor: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-100 dark:bg-yellow-900",
      description: t("management.productionHistory.metrics.averageQualityDescription"),
    },
    {
      title: t("management.productionHistory.metrics.efficiency"),
      value: metrics.efficiency.toFixed(1),
      suffix: "%",
      icon: TrendingUp,
      iconColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900",
      description: t("management.productionHistory.metrics.efficiencyDescription"),
    },
    {
      title: t("management.productionHistory.metrics.totalOutput"),
      value: metrics.totalOutput,
      suffix: ` ${t("management.productionHistory.metrics.units")}`,
      icon: Package,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900",
      description: t("management.productionHistory.metrics.totalOutputDescription"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold">
                      {card.value}
                    </p>
                    {card.suffix && (
                      <p className="text-sm text-muted-foreground">{card.suffix}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
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
