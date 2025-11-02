"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProductionBatch } from "@/types/entities";
import {
  Clock,
  Package,
  Star,
  Eye,
  CheckCircle,
  Loader2,
  AlertCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface ProductionBatchCardProps {
  batch: ProductionBatch;
  onViewDetails?: (batch: ProductionBatch) => void;
  onUpdateStatus?: (batch: ProductionBatch) => void;
}

export function ProductionBatchCard({
  batch,
  onViewDetails,
  onUpdateStatus
}: ProductionBatchCardProps) {
  const { t } = useI18n();

  // Get status badge configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      PENDING: {
        label: t("management.recipeProduction.statuses.pending"),
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        icon: Clock
      },
      IN_PROGRESS: {
        label: t("management.recipeProduction.statuses.inProgress"),
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
        icon: Loader2
      },
      QUALITY_CHECK: {
        label: t("management.recipeProduction.statuses.qualityCheck"),
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
        icon: AlertCircle
      },
      COMPLETED: {
        label: t("management.recipeProduction.statuses.completed"),
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        icon: CheckCircle
      },
      FAILED: {
        label: t("management.recipeProduction.statuses.failed"),
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        icon: XCircle
      }
    };
    return configs[status as keyof typeof configs] || configs.PENDING;
  };

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;
  const progress = batch.quantityPlanned > 0
    ? (batch.quantityProduced / batch.quantityPlanned) * 100
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{batch.batchNumber}</p>
              <p className="text-sm text-muted-foreground">
                {t("management.recipeProduction.started")}: {batch.startedAt ? format(new Date(batch.startedAt), "MMM d, yyyy HH:mm") : t("common.notAvailable")}
              </p>
            </div>
            <Badge className={statusConfig.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-4 w-4" />
                {t("management.recipeProduction.quantity")}
              </span>
              <span className="font-medium">
                {batch.quantityProduced} / {batch.quantityPlanned} {batch.unit}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Quality Score (if completed) */}
          {batch.status === "completed" && batch.qualityScore !== null && batch.qualityScore !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Star className="h-4 w-4" />
                {t("management.recipeProduction.qualityScore")}
              </span>
              <span className="font-medium">
                {batch.qualityScore.toFixed(1)} / 10
              </span>
            </div>
          )}

          {/* Completion Date (if completed) */}
          {batch.status === "completed" && batch.completedAt && (
            <div className="text-sm text-muted-foreground">
              {t("management.recipeProduction.completed")}: {format(new Date(batch.completedAt), "MMM d, yyyy HH:mm")}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(batch)}
                className="flex-1"
              >
                <Eye className="mr-1 h-4 w-4" />
                {t("common.actions.view")}
              </Button>
            )}
            {onUpdateStatus && batch.status !== "completed" && batch.status !== "failed" && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onUpdateStatus(batch)}
                className="flex-1"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {t("common.actions.update")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
