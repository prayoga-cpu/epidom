"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast as sonnerToast } from "sonner";
import { Clock, Package, CheckCircle, XCircle, Ban, Loader2 } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { format } from "date-fns";
import {
  useCompleteProduction,
  useCancelProduction,
  ProductionBatchWithRelations,
} from "./hooks/use-production-batches";

interface ProductionBatchCardProps {
  batch: ProductionBatchWithRelations;
}

export function ProductionBatchCard({ batch }: ProductionBatchCardProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Mutations
  const completeProduction = useCompleteProduction(storeId);
  const cancelProduction = useCancelProduction(storeId);

  // Dialog states
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState(Number(batch.plannedQuantity));
  const [restoreMaterials, setRestoreMaterials] = useState(true);

  // Get status badge configuration - neutral colors only
  const getStatusConfig = (status: string) => {
    const configs = {
      PLANNED: {
        label: t("management.recipeProduction.statuses.planned") || "Planned",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: t("management.recipeProduction.statuses.inProgress") || "In Progress",
        color: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50",
        icon: Loader2,
      },
      COMPLETED: {
        label: t("management.recipeProduction.statuses.completed") || "Completed",
        color: "bg-gray-300 text-gray-950 dark:bg-gray-600 dark:text-white",
        icon: CheckCircle,
      },
      CANCELLED: {
        label: t("management.recipeProduction.statuses.cancelled") || "Cancelled",
        color: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
        icon: XCircle,
      },
    };
    return configs[status as keyof typeof configs] || configs.PLANNED;
  };

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;

  // Handle complete production
  const handleComplete = async () => {
    try {
      await completeProduction.mutateAsync({
        batchId: batch.id,
        data: { actualQuantity },
      });

      sonnerToast.success(
        t("management.recipeProduction.messages.completeSuccess") || "Production Completed",
        {
          description:
            t("management.recipeProduction.messages.completeSuccessDescription")?.replace(
              "{batchNumber}",
              batch.batchNumber
            ) || `Batch ${batch.batchNumber} has been completed successfully`,
        }
      );

      setCompleteDialogOpen(false);
    } catch (error) {
      sonnerToast.error(t("common.error") || "Error", {
        description:
          error instanceof Error
            ? error.message
            : t("management.recipeProduction.messages.completeError") ||
              "Failed to complete production",
      });
    }
  };

  // Handle cancel production
  const handleCancel = async () => {
    try {
      await cancelProduction.mutateAsync({
        batchId: batch.id,
        data: { restoreMaterials },
      });

      sonnerToast.success(
        t("management.recipeProduction.messages.cancelSuccess") || "Production Cancelled",
        {
          description:
            t("management.recipeProduction.messages.cancelSuccessDescription")
              ?.replace("{batchNumber}", batch.batchNumber)
              ?.replace(
                "{materialsRestored}",
                restoreMaterials
                  ? t("management.recipeProduction.messages.materialsRestored") ||
                      " and materials restored"
                  : ""
              ) ||
            `Batch ${batch.batchNumber} has been cancelled${restoreMaterials ? " and materials restored" : ""}`,
        }
      );

      setCancelDialogOpen(false);
    } catch (error) {
      sonnerToast.error(t("common.error") || "Error", {
        description:
          error instanceof Error
            ? error.message
            : t("management.recipeProduction.messages.cancelError") ||
              "Failed to cancel production",
      });
    }
  };

  return (
    <>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{batch.batchNumber}</p>
                <p className="text-muted-foreground text-sm">{batch.product.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t("management.recipeProduction.scheduled") || "Scheduled"}:{" "}
                  {format(new Date(batch.scheduledDate), "MMM d, yyyy")}
                </p>
              </div>
              <Badge className={statusConfig.color}>
                <StatusIcon
                  className={`mr-1 h-3 w-3 ${batch.status === "IN_PROGRESS" ? "animate-spin" : ""}`}
                />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Quantity Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Package className="h-4 w-4" />
                {t("management.recipeProduction.quantity") || "Quantity"}
              </span>
              <span className="font-medium">
                {batch.actualQuantity || batch.plannedQuantity} {batch.unit}
              </span>
            </div>

            {/* Completion Date (if completed) */}
            {batch.status === "COMPLETED" && batch.completedDate && (
              <div className="text-muted-foreground text-sm">
                {t("management.recipeProduction.completed") || "Completed"}:{" "}
                {format(new Date(batch.completedDate), "MMM d, yyyy HH:mm")}
              </div>
            )}

            {/* Notes */}
            {batch.notes && (
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">{t("common.notes") || "Notes"}:</span> {batch.notes}
              </div>
            )}

            {/* Actions */}
            {batch.status === "IN_PROGRESS" && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompleteDialogOpen(true)}
                  className="flex-1"
                  disabled={completeProduction.isPending}
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  {t("common.actions.complete") || "Complete"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  className="flex-1"
                  disabled={cancelProduction.isPending}
                >
                  <Ban className="mr-1 h-4 w-4" />
                  {t("common.actions.cancel") || "Cancel"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complete Production Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <FormDialogLayout
          title={t("management.recipeProduction.dialogs.complete.title") || "Complete Production"}
          description={
            t("management.recipeProduction.dialogs.complete.description") ||
            "Enter the actual quantity produced for this batch"
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setCompleteDialogOpen(false)}
                disabled={completeProduction.isPending}
              >
                {t("common.actions.cancel") || "Cancel"}
              </Button>
              <Button
                onClick={handleComplete}
                disabled={completeProduction.isPending || actualQuantity <= 0}
              >
                {completeProduction.isPending && (
                  <LottieLoader size="xs" className="mr-1 hidden sm:inline" />
                )}
                {t("common.actions.complete") || "Complete"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualQuantity">
                {t("management.recipeProduction.actualQuantity") || "Actual Quantity"} ({batch.unit}
                )
              </Label>
              <Input
                id="actualQuantity"
                type="number"
                step="0.01"
                min="0.01"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(Number(e.target.value))}
                placeholder={String(batch.plannedQuantity)}
              />
              <p className="text-muted-foreground text-sm">
                {t("management.recipeProduction.plannedWas") || "Planned was"}:{" "}
                {batch.plannedQuantity} {batch.unit}
              </p>
            </div>
          </div>
        </FormDialogLayout>
      </Dialog>

      {/* Cancel Production Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <FormDialogLayout
          title={t("management.recipeProduction.dialogs.cancel.title") || "Cancel Production"}
          description={
            t("management.recipeProduction.dialogs.cancel.description") ||
            "Are you sure you want to cancel this production batch?"
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelProduction.isPending}
              >
                {t("common.actions.back") || "Back"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelProduction.isPending}
              >
                {cancelProduction.isPending && (
                  <LottieLoader size="xs" className="mr-1 hidden sm:inline" />
                )}
                {t("common.actions.cancelBatch") || "Cancel Batch"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="restoreMaterials"
                checked={restoreMaterials}
                onCheckedChange={(checked) => setRestoreMaterials(checked as boolean)}
              />
              <Label htmlFor="restoreMaterials" className="cursor-pointer">
                {t("management.recipeProduction.restoreMaterials") ||
                  "Restore materials to inventory"}
              </Label>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("management.recipeProduction.restoreMaterialsHint") ||
                "Materials used for this batch will be added back to your inventory"}
            </p>
          </div>
        </FormDialogLayout>
      </Dialog>
    </>
  );
}
