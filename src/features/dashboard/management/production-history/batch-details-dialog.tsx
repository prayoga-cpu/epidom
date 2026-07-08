"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Package,
  Clock,
  DollarSign,
  CheckCircle,
  Loader2,
  Calendar,
  Download,
  Edit,
  Ban,
  ChefHat,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/components/providers/currency-provider";
import { getTranslatedCategory } from "@/features/dashboard/data/recipes/utils/category-helpers";
import {
  useUpdateProductionBatch,
  useCompleteProduction,
} from "@/features/dashboard/management/recipe-production/hooks/use-production-batches";
import { exportToCSV } from "@/lib/utils/export";
import { convertUnit } from "@/lib/utils/unit-conversion";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";

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
  productionTimeMinutes?: number;
  costPerBatch?: number;
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
  const { advancedReportsAccess } = useFeatureAccess();
  const params = useParams();
  const storeId = params?.storeId as string;
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const updateBatch = useUpdateProductionBatch(storeId, batch.id);
  const completeProduction = useCompleteProduction(storeId);

  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState(Number(batch.plannedQuantity));

  // Form for updating batch (using string for scheduledDate to match input type)
  const updateForm = useForm<{
    plannedQuantity?: number;
    scheduledDate?: string;
    notes?: string;
  }>({
    defaultValues: {
      plannedQuantity: batch.plannedQuantity,
      scheduledDate: batch.scheduledDate
        ? format(new Date(batch.scheduledDate), "yyyy-MM-dd'T'HH:mm")
        : undefined,
      notes: batch.notes || undefined,
    },
  });

  // Handle update form submission
  const handleUpdateSubmit = async (data: {
    plannedQuantity?: number;
    scheduledDate?: string;
    notes?: string;
  }) => {
    try {
      await updateBatch.mutateAsync({
        plannedQuantity: data.plannedQuantity,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        notes: data.notes,
      });
      toast.success(t("common.actions.updateSuccess") || "Production batch updated successfully");
      setIsUpdateDialogOpen(false);
      onOpenChange(false); // Close detail dialog to refresh data
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.actions.updateError") || "Failed to update production batch"
      );
    }
  };

  // Handle complete production
  const handleComplete = async () => {
    try {
      await completeProduction.mutateAsync({
        batchId: batch.id,
        data: { actualQuantity },
      });

      toast.success(
        t("management.recipeProduction.messages.completeSuccess") ||
          "Production batch completed successfully"
      );
      setIsCompleteDialogOpen(false);
      onOpenChange(false); // Close detail dialog to refresh data
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("management.recipeProduction.messages.completeError") ||
              "Failed to complete production batch"
      );
    }
  };

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
        const quantityUsedInMaterialUnit = convertUnit(
          quantityUsed,
          ingredient.unit,
          material.unit
        );
        const cost = quantityUsedInMaterialUnit * materialCost;

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
        color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border-gray-200",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: t("management.productionHistory.statuses.inProgress") || "In Progress",
        color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200",
        icon: Loader2,
      },
      COMPLETED: {
        label: t("management.productionHistory.statuses.completed") || "Completed",
        color:
          "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200",
        icon: CheckCircle,
      },
      CANCELLED: {
        label: t("management.productionHistory.statuses.cancelled") || "Cancelled",
        color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200",
        icon: Ban,
      },
    };
    return configs[status as keyof typeof configs] || configs.PLANNED;
  };

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;

  // Handle export
  const handleExport = () => {
    try {
      const exportData = [
        {
          [t("management.productionHistory.batchNumber")]: batch.batchNumber,
          [t("management.productionHistory.recipe")]: recipe?.name || batch.product.name,
          [t("management.productionHistory.status")]: statusConfig.label,
          [t("management.productionHistory.quantity")]: `${
            batch.actualQuantity || 0
          }/${batch.plannedQuantity} ${batch.unit}`,
          [t("management.productionHistory.scheduledDate")]: batch.scheduledDate
            ? format(new Date(batch.scheduledDate), "yyyy-MM-dd HH:mm")
            : t("common.notAvailable"),
          [t("management.productionHistory.completedAt")]: batch.completedDate
            ? format(new Date(batch.completedDate), "yyyy-MM-dd HH:mm")
            : t("common.notAvailable"),
          [t("management.productionHistory.costAnalysis")]: formatPrice(
            costAnalysis.batchTotalCost
          ),
          [t("management.productionHistory.unitCost")]: formatPrice(costAnalysis.unitCost),
        },
      ];

      exportToCSV(
        exportData,
        `production-batch-${batch.batchNumber}-${format(new Date(), "yyyy-MM-dd")}`
      );
      toast.success(t("common.actions.exportSuccess") || "Data exported successfully");
    } catch (error) {
      toast.error(t("common.actions.exportError") || "Failed to export data");
    }
  };

  // Handle update button click
  const handleUpdateClick = () => {
    setIsUpdateDialogOpen(true);
  };

  if (!recipe) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-full max-h-[100dvh] w-full flex-col gap-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:rounded-lg [&>button]:hidden">
        <DialogHeader className="border-b p-4 pb-2 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl">
                {t("management.productionHistory.dialogs.batchDetails.title")}
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                {batch.batchNumber}
              </DialogDescription>
            </div>
            <Badge className={`w-fit px-3 py-1 ${statusConfig.color}`} variant="outline">
              <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6 dark:bg-transparent">
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="flex flex-col gap-4">
              <Card className="flex-1 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary rounded-full p-3">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        {t("management.productionHistory.quantity")}
                      </p>
                      <p className="text-xl font-bold sm:text-2xl">
                        {batch.actualQuantity || 0}
                        <span className="text-muted-foreground text-base font-normal">
                          /{batch.plannedQuantity} {batch.unit}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        {t("management.productionHistory.actualCost")}
                      </p>
                      <p className="text-xl font-bold sm:text-2xl">
                        {formatPrice(costAnalysis.actual)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {duration && (
                <Card className="flex-1 shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                          {t("management.productionHistory.duration")}
                        </p>
                        <p className="text-xl font-bold sm:text-2xl">
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
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <ChefHat className="text-muted-foreground h-5 w-5" />
                {t("management.productionHistory.recipeInformation")}
              </h3>
              <Card className="shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.recipeName")}
                      </p>
                      <p className="text-base font-medium">{recipe.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.category")}
                      </p>
                      <p className="text-base font-medium">
                        {getTranslatedCategory(recipe.category, t)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.expectedYield")}
                      </p>
                      <p className="text-base font-medium">
                        {recipe.yieldQuantity} {recipe.yieldUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.expectedTime")}
                      </p>
                      <p className="text-base font-medium">
                        {recipe.productionTimeMinutes} {t("common.time.minutes")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ingredient Consumption */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Package className="text-muted-foreground h-5 w-5" />
                {t("management.productionHistory.ingredientConsumption")}
              </h3>
              <Card className="overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    {/* Desktop Header */}
                    <div className="bg-muted/50 text-muted-foreground hidden grid-cols-12 gap-4 border-b px-6 py-3 text-xs font-medium tracking-wider uppercase sm:grid">
                      <div className="col-span-5">{t("management.productionHistory.material")}</div>
                      <div className="col-span-3 text-right">
                        {t("management.productionHistory.quantityUsed")}
                      </div>
                      <div className="col-span-2 text-right">
                        {t("management.productionHistory.costPerUnit")}
                      </div>
                      <div className="col-span-2 text-right">
                        {t("management.productionHistory.totalCost")}
                      </div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y">
                      {ingredientConsumption.map((ingredient, index) => (
                        <div
                          key={index}
                          className="hover:bg-muted/5 flex flex-col gap-2 p-4 text-sm transition-colors sm:grid sm:grid-cols-12 sm:items-center sm:gap-4 sm:px-6 sm:py-4"
                        >
                          {/* Material Name */}
                          <div className="font-medium sm:col-span-5">{ingredient.materialName}</div>

                          {/* Mobile Details / Desktop Columns */}
                          <div className="flex justify-between sm:contents">
                            {/* Quantity */}
                            <div className="sm:col-span-3 sm:text-right">
                              <span className="text-muted-foreground mr-2 sm:hidden">Qty:</span>
                              {ingredient.quantityUsed.toFixed(2)} {ingredient.unit}
                            </div>

                            {/* Cost Per Unit - Hidden on very small screens if needed, or shown */}
                            <div className="sm:col-span-2 sm:text-right">
                              <span className="text-muted-foreground mr-2 sm:hidden">Cost:</span>
                              {formatPrice(ingredient.costPerUnit)}
                            </div>
                          </div>

                          {/* Total Cost */}
                          <div className="mt-1 flex justify-between border-t pt-2 font-medium sm:col-span-2 sm:mt-0 sm:justify-end sm:border-0 sm:pt-0 sm:text-right">
                            <span className="text-muted-foreground sm:hidden">Total:</span>
                            {formatPrice(ingredient.totalCost)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Production Timeline */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="text-muted-foreground h-5 w-5" />
                {t("management.productionHistory.productionTimeline")}
              </h3>
              <Card className="shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-muted mt-0.5 rounded-full p-1.5">
                        <Calendar className="text-muted-foreground h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {t("management.productionHistory.scheduledDate") || "Scheduled"}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {batch.scheduledDate
                            ? format(new Date(batch.scheduledDate), "MMMM d, yyyy 'at' HH:mm")
                            : t("common.notAvailable")}
                        </p>
                      </div>
                    </div>

                    {batch.completedDate && (
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 rounded-full bg-green-100 p-1.5 dark:bg-green-900/30">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {t("management.productionHistory.completedAt")}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {format(new Date(batch.completedDate), "MMMM d, yyyy 'at' HH:mm")}
                          </p>
                        </div>
                      </div>
                    )}

                    {duration && (
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 rounded-full bg-blue-100 p-1.5 dark:bg-blue-900/30">
                          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {t("management.productionHistory.totalDuration")}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {duration.hours > 0
                              ? `${duration.hours} ${t("common.time.hours")} `
                              : ""}
                            {duration.remainingMinutes} {t("common.time.minutes")}
                            {recipe?.productionTimeMinutes && (
                              <span className="ml-2 text-xs">
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
            </div>

            {/* Cost Analysis */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="text-muted-foreground h-5 w-5" />
                {t("management.productionHistory.costAnalysis")}
              </h3>
              <Card className="shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.unitCost") || "Cost per Unit"}
                      </p>
                      <p className="text-2xl font-bold">{formatPrice(costAnalysis.unitCost)}</p>
                      <p className="text-muted-foreground text-xs">
                        {t("management.productionHistory.perUnit") || "Per"} {batch.unit}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        {t("management.productionHistory.batchTotalCost") || "Batch Total Cost"}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatPrice(costAnalysis.batchTotalCost)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("management.productionHistory.forQuantity") || "For"}{" "}
                        {batch.actualQuantity || batch.plannedQuantity} {batch.unit}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-background z-10 flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:p-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={!advancedReportsAccess}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("common.actions.export")}
                </Button>
              </div>
            </TooltipTrigger>
            {!advancedReportsAccess && (
              <TooltipContent>
                <p>{t("billing.advancedReportsOnly")}</p>
              </TooltipContent>
            )}
          </Tooltip>
          {batch.status === "IN_PROGRESS" && (
            <Button
              onClick={() => setIsCompleteDialogOpen(true)}
              disabled={completeProduction.isPending}
              className="w-full sm:w-auto"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t("common.actions.complete") || "Complete"}
            </Button>
          )}
          {batch.status !== "COMPLETED" && batch.status !== "CANCELLED" && (
            <Button
              onClick={handleUpdateClick}
              disabled={updateBatch.isPending}
              className="w-full sm:w-auto"
            >
              <Edit className="mr-2 h-4 w-4" />
              {t("common.actions.update")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Update Production Batch Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("management.productionHistory.updateBatch") || "Update Production Batch"}
            </DialogTitle>
            <DialogDescription>
              {t("management.productionHistory.updateBatchDescription") ||
                "Update production batch details"}
            </DialogDescription>
          </DialogHeader>

          <form
            id="update-batch-form"
            onSubmit={updateForm.handleSubmit(handleUpdateSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="plannedQuantity">
                {t("management.productionHistory.plannedQuantity") || "Planned Quantity"} (
                {batch.unit})
              </Label>
              <Controller
                control={updateForm.control}
                name="plannedQuantity"
                render={({ field }) => (
                  <DecimalInput
                    id="plannedQuantity"
                    decimals={3}
                    min={0}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
              {updateForm.formState.errors.plannedQuantity && (
                <p className="text-destructive text-sm">
                  {updateForm.formState.errors.plannedQuantity.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">
                {t("management.productionHistory.scheduledDate") || "Scheduled Date"}
              </Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                {...updateForm.register("scheduledDate")}
              />
              {updateForm.formState.errors.scheduledDate && (
                <p className="text-destructive text-sm">
                  {updateForm.formState.errors.scheduledDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("management.productionHistory.notes") || "Notes"}</Label>
              <Textarea
                id="notes"
                rows={4}
                {...updateForm.register("notes")}
                placeholder={
                  t("management.productionHistory.notesPlaceholder") ||
                  "Add notes about this production batch..."
                }
              />
              {updateForm.formState.errors.notes && (
                <p className="text-destructive text-sm">
                  {updateForm.formState.errors.notes.message}
                </p>
              )}
            </div>
          </form>

          <DialogFooter>
            <FormDialogFooter
              formId="update-batch-form"
              onCancel={() => setIsUpdateDialogOpen(false)}
              submitText={t("common.actions.update") || "Update"}
              isPending={updateBatch.isPending}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Production Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("management.recipeProduction.dialogs.complete.title") || "Complete Production"}
            </DialogTitle>
            <DialogDescription>
              {t("management.recipeProduction.dialogs.complete.description") ||
                "Enter the actual quantity produced for this batch"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actualQuantity">
                {t("management.recipeProduction.actualQuantity") || "Actual Quantity"} ({batch.unit}
                )
              </Label>
              <DecimalInput
                id="actualQuantity"
                decimals={3}
                min={0}
                value={actualQuantity}
                onChange={(value) => setActualQuantity(value ?? 0)}
                placeholder={String(batch.plannedQuantity)}
              />
              <p className="text-muted-foreground text-sm">
                {t("management.recipeProduction.plannedWas") || "Planned was"}:{" "}
                {batch.plannedQuantity} {batch.unit}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCompleteDialogOpen(false)}
              disabled={completeProduction.isPending}
            >
              {t("common.actions.cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleComplete}
              disabled={completeProduction.isPending || actualQuantity <= 0}
            >
              {completeProduction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.actions.complete") || "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
