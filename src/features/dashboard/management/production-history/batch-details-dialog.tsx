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
import {
  Package,
  Clock,
  Star,
  DollarSign,
  CheckCircle,
  Loader2,
  Calendar,
  Download,
  Edit,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";

interface Material {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  unitCost: number;
}

interface RecipeIngredient {
  id: string;
  materialId: string;
  quantity: number;
  unit: string;
  material: Material;
}

interface Recipe {
  id: string;
  name: string;
  category?: string;
  yieldQuantity: number;
  yieldUnit: string;
  productionTimeMinutes: number;
  costPerBatch: number;
  ingredients: RecipeIngredient[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface ProductionBatchDetails {
  id: string;
  batchNumber: string;
  productId: string;
  recipeId: string | null;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledDate: Date | string;
  completedDate: Date | string | null;
  notes: string | null;
  storeId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  product: Product;
  recipe: Recipe | null;
}

interface BatchDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: ProductionBatchDetails;
}

export function BatchDetailsDialog({ open, onOpenChange, batch }: BatchDetailsDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  // Use recipe from batch relations
  const recipe = batch.recipe;
  const product = batch.product;

  // Get ingredient consumption from recipe
  const ingredientConsumption = useMemo(() => {
    if (!recipe?.ingredients) return [];

    const plannedQty = Number(batch.plannedQuantity) || 0;
    const yieldQty = Number(recipe.yieldQuantity) || 1;
    const batchMultiplier = plannedQty / yieldQty;

    return recipe.ingredients
      .map((ingredient: RecipeIngredient) => {
        const material = ingredient.material;
        if (!material) return null;

        const ingredientQty = Number(ingredient.quantity) || 0;
        const materialCost = Number(material.unitCost) || 0;
        const quantityUsed = ingredientQty * batchMultiplier;
        const cost = quantityUsed * materialCost;

        return {
          materialName: material.name,
          quantityUsed,
          unit: ingredient.unit,
          costPerUnit: materialCost,
          totalCost: cost,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [recipe, batch.plannedQuantity]);

  // Calculate cost analysis
  const costAnalysis = useMemo(() => {
    if (!recipe) return { estimated: 0, actual: 0, variance: 0, unitCost: 0, batchTotalCost: 0 };

    const plannedQty = Number(batch.plannedQuantity) || 0;
    const actualQty = Number(batch.actualQuantity) || plannedQty;
    const yieldQty = Number(recipe.yieldQuantity) || 1;
    const batchMultiplier = plannedQty / yieldQty;
    const costPerBatch = Number(recipe.costPerBatch) || 0;
    const estimated = costPerBatch * batchMultiplier;
    const batchTotalCost = ingredientConsumption.reduce((sum, ing) => {
      const cost = Number(ing.totalCost) || 0;
      return sum + cost;
    }, 0);
    const unitCost = actualQty > 0 ? batchTotalCost / actualQty : 0;
    const variance = batchTotalCost - estimated;

    return { estimated, actual: batchTotalCost, variance, unitCost, batchTotalCost };
  }, [recipe, ingredientConsumption, batch.plannedQuantity, batch.actualQuantity]);

  // Calculate production duration
  const duration = useMemo(() => {
    if (!batch.completedDate || !batch.scheduledDate) return null;
    const start = new Date(batch.scheduledDate).getTime();
    const end = new Date(batch.completedDate).getTime();
    const diff = end - start;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return { minutes, hours, remainingMinutes };
  }, [batch.scheduledDate, batch.completedDate]);

  // Get status configuration with neutral colors
  const getStatusConfig = (status: string) => {
    const configs = {
      PLANNED: {
        label: t("management.productionHistory.statuses.planned") || "Planned",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: t("management.productionHistory.statuses.inProgress") || "In Progress",
        color: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50",
        icon: Loader2,
      },
      COMPLETED: {
        label: t("management.productionHistory.statuses.completed") || "Completed",
        color: "bg-gray-300 text-gray-950 dark:bg-gray-600 dark:text-white",
        icon: CheckCircle,
      },
      CANCELLED: {
        label: t("management.productionHistory.statuses.cancelled") || "Cancelled",
        color: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
        icon: Ban,
      },
    };
    return configs[status as keyof typeof configs] || configs.PLANNED;
  };

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;

  if (!recipe) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-4xl overflow-y-auto [&>button]:hidden">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-200 p-2 dark:bg-gray-700">
                    <Package className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.productionHistory.quantity")}
                    </p>
                    <p className="text-xl font-bold">
                      {batch.actualQuantity || 0}/{batch.plannedQuantity} {batch.unit}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-200 p-2 dark:bg-gray-700">
                    <DollarSign className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.productionHistory.actualCost")}
                    </p>
                    <p className="text-xl font-bold">{formatPrice(costAnalysis.actual)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {duration && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-200 p-2 dark:bg-gray-700">
                      <Clock className="h-5 w-5 text-gray-700 dark:text-gray-300" />
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
                  <p className="font-medium">
                    {recipe.productionTimeMinutes} {t("common.time.minutes")}
                  </p>
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
                      <div className="col-span-4 font-medium">{ingredient.materialName}</div>
                      <div className="text-muted-foreground col-span-3 text-right">
                        {ingredient.quantityUsed.toFixed(2)} {ingredient.unit}
                      </div>
                      <div className="text-muted-foreground col-span-2 text-right">
                        {formatPrice(ingredient.costPerUnit)}
                      </div>
                      <div className="col-span-3 text-right font-medium">
                        {formatPrice(ingredient.totalCost)}
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
                      {t("management.productionHistory.scheduledDate") || "Scheduled"}
                    </p>
                    <p className="font-medium">
                      {batch.scheduledDate
                        ? format(new Date(batch.scheduledDate), "MMMM d, yyyy 'at' HH:mm")
                        : t("common.notAvailable")}
                    </p>
                  </div>
                </div>
                {batch.completedDate && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.completedAt")}
                      </p>
                      <p className="font-medium">
                        {format(new Date(batch.completedDate), "MMMM d, yyyy 'at' HH:mm")}
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
                        {recipe?.productionTimeMinutes && (
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

          {/* Cost Analysis */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-lg font-semibold">
                {t("management.productionHistory.costAnalysis")}
              </h3>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.unitCost") || "Cost per Unit"}
                  </p>
                  <p className="text-lg font-bold">{formatPrice(costAnalysis.unitCost)}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("management.productionHistory.perUnit") || "Per"} {batch.unit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("management.productionHistory.batchTotalCost") || "Batch Total Cost"}
                  </p>
                  <p className="text-lg font-bold">{formatPrice(costAnalysis.batchTotalCost)}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("management.productionHistory.forQuantity") || "For"}{" "}
                    {batch.actualQuantity || batch.plannedQuantity} {batch.unit}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <Download className="mr-1 h-4 w-4 hidden sm:inline" />
              {t("common.actions.export")}
            </Button>
            {batch.status !== "COMPLETED" && batch.status !== "CANCELLED" && (
              <Button>
                <Edit className="mr-1 h-4 w-4 hidden sm:inline" />
                {t("common.actions.update")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
