"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductionBatch } from "@/types/entities";
import { MOCK_RECIPES, MOCK_RECIPE_INGREDIENTS, MOCK_MATERIALS } from "@/mocks";
import {
  Package,
  Clock,
  Star,
  DollarSign,
  CheckCircle,
  Loader2,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/formatting";

interface BatchDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: ProductionBatch;
}

export function BatchDetailsDialog({ open, onOpenChange, batch }: BatchDetailsDialogProps) {
  const { t } = useI18n();

  // Get recipe details
  const recipe = useMemo(() => {
    return MOCK_RECIPES.find((r) => r.id === batch.recipeId);
  }, [batch.recipeId]);

  // Get ingredient consumption
  const ingredientConsumption = useMemo(() => {
    if (!recipe) return [];

    const ingredients = MOCK_RECIPE_INGREDIENTS.filter((ri) => ri.recipeId === recipe.id);

    return ingredients
      .map((ingredient) => {
        const material = MOCK_MATERIALS.find((m) => m.id === ingredient.materialId);
        if (!material) return null;

        const quantityUsed = ingredient.quantity * 1; // Assuming 1 batch was made
        const cost = quantityUsed * material.costPerUnit;

        return {
          materialName: material.name,
          quantityUsed,
          unit: material.unit,
          costPerUnit: material.costPerUnit,
          totalCost: cost,
        };
      })
      .filter(Boolean);
  }, [recipe]);

  // Calculate cost analysis
  const costAnalysis = useMemo(() => {
    if (!recipe) return { estimated: 0, actual: 0, variance: 0 };

    const estimated = recipe.costPerBatch;
    const actual = ingredientConsumption.reduce((sum, ing) => sum + (ing?.totalCost || 0), 0);
    const variance = actual - estimated;

    return { estimated, actual, variance };
  }, [recipe, ingredientConsumption]);

  // Calculate production duration
  const duration = useMemo(() => {
    if (!batch.completedAt || !batch.startedAt) return null;
    const start = new Date(batch.startedAt as string | Date).getTime();
    const end = new Date(batch.completedAt as string | Date).getTime();
    const diff = end - start;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return { minutes, hours, remainingMinutes };
  }, [batch.startedAt, batch.completedAt]);

  // Get status configuration
  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        label: t("management.productionHistory.statuses.pending"),
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        icon: Clock,
      },
      in_progress: {
        label: t("management.productionHistory.statuses.inProgress"),
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
        icon: Loader2,
      },
      quality_check: {
        label: t("management.productionHistory.statuses.qualityCheck"),
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
        icon: AlertCircle,
      },
      completed: {
        label: t("management.productionHistory.statuses.completed"),
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        icon: CheckCircle,
      },
      failed: {
        label: t("management.productionHistory.statuses.failed"),
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
        icon: XCircle,
      },
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;

  if (!recipe) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>
                {t("management.productionHistory.dialogs.batchDetails.title")}
              </DialogTitle>
              <DialogDescription>{batch.batchNumber}</DialogDescription>
            </div>
            <Badge className={statusConfig.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.productionHistory.quantity")}
                    </p>
                    <p className="text-xl font-bold">
                      {batch.quantityProduced}/{batch.quantityPlanned}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {batch.qualityScore !== null && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900">
                      <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.qualityScore")}
                      </p>
                      <p className="text-xl font-bold">
                        {batch.qualityScore?.toFixed(1) || t("common.notAvailable")}/10
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.productionHistory.actualCost")}
                    </p>
                    <p className="text-xl font-bold">{formatCurrency(costAnalysis.actual)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {duration && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                      <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.duration")}
                      </p>
                      <p className="text-xl font-bold">
                        {duration.hours > 0 ? `${duration.hours}h ` : ""}
                        {duration.remainingMinutes}m
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recipe Information */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-lg font-semibold">
                {t("management.productionHistory.recipeInformation")}
              </h3>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.recipeName")}
                  </p>
                  <p className="font-medium">{recipe.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.category")}
                  </p>
                  <p className="font-medium">{recipe.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.expectedYield")}
                  </p>
                  <p className="font-medium">
                    {recipe.yieldQuantity} {recipe.yieldUnit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.expectedTime")}
                  </p>
                  <p className="font-medium">{recipe.productionTimeMinutes} {t("common.time.minutes")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredient Consumption */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-lg font-semibold">
                {t("management.productionHistory.ingredientConsumption")}
              </h3>
              <Separator />
              <div className="overflow-hidden rounded-lg border">
                <div className="bg-muted grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium">
                  <div className="col-span-4">{t("management.productionHistory.material")}</div>
                  <div className="col-span-3 text-right">
                    {t("management.productionHistory.quantityUsed")}
                  </div>
                  <div className="col-span-2 text-right">
                    {t("management.productionHistory.costPerUnit")}
                  </div>
                  <div className="col-span-3 text-right">
                    {t("management.productionHistory.totalCost")}
                  </div>
                </div>
                <div className="divide-y">
                  {ingredientConsumption.map((ingredient, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 px-4 py-3 text-sm">
                      <div className="col-span-4 font-medium">{ingredient?.materialName}</div>
                      <div className="text-muted-foreground col-span-3 text-right">
                        {ingredient?.quantityUsed.toFixed(2)} {ingredient?.unit}
                      </div>
                      <div className="text-muted-foreground col-span-2 text-right">
                        {formatCurrency(ingredient?.costPerUnit)}
                      </div>
                      <div className="col-span-3 text-right font-medium">
                        {formatCurrency(ingredient?.totalCost)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Production Timeline */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-lg font-semibold">
                {t("management.productionHistory.productionTimeline")}
              </h3>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="text-muted-foreground h-5 w-5" />
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.productionHistory.startedAt")}
                    </p>
                    <p className="font-medium">
                      {batch.startedAt
                        ? format(
                            new Date(batch.startedAt as string | Date),
                            "MMMM d, yyyy 'at' HH:mm"
                          )
                        : t("common.notAvailable")}
                    </p>
                  </div>
                </div>
                {batch.completedAt && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.completedAt")}
                      </p>
                      <p className="font-medium">
                        {format(new Date(batch.completedAt), "MMMM d, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                )}
                {duration && (
                  <div className="flex items-center gap-3">
                    <Clock className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.totalDuration")}
                      </p>
                      <p className="font-medium">
                        {duration.hours > 0 ? `${duration.hours} ${t("common.time.hours")} ` : ""}
                        {duration.remainingMinutes} {t("common.time.minutes")}
                        {recipe.productionTimeMinutes && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            ({t("management.productionHistory.expected")}:{" "}
                            {recipe.productionTimeMinutes} {t("common.time.minutesShort")})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quality Notes */}
          {batch.qualityScore !== null && batch.qualityNotes && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Star className="h-5 w-5" />
                  {t("management.productionHistory.qualityNotes")}
                </h3>
                <Separator />
                <p className="text-muted-foreground text-sm">{batch.qualityNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Cost Analysis */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-lg font-semibold">
                {t("management.productionHistory.costAnalysis")}
              </h3>
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.estimatedCost")}
                  </p>
                  <p className="text-lg font-bold">{formatCurrency(costAnalysis.estimated)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.actualCost")}
                  </p>
                  <p className="text-lg font-bold">{formatCurrency(costAnalysis.actual)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.variance")}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      costAnalysis.variance > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {costAnalysis.variance > 0 ? "+" : ""}
                    {formatCurrency(Math.abs(costAnalysis.variance))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.actions.export")}
            </Button>
            {batch.status !== "completed" && batch.status !== "failed" && (
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                {t("common.actions.update")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
