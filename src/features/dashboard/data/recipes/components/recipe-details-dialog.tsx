"use client";

import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  DollarSign,
  Clock,
  FileText,
  Edit,
  Trash2,
  TrendingUp,
  ChefHat,
  Calculator,
  Calendar,
  ShoppingBag,
  AlertCircle,
  CheckCircle,
  XCircle,
  Box,
} from "lucide-react";
import { formatCurrency, formatDate, formatDuration, formatNumber } from "@/lib/utils/formatting";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useMaterials } from "../../materials/hooks/use-materials";
import type { RecipeWithIngredients } from "../hooks/use-recipes";
import { getTranslatedCategory } from "../utils/category-helpers";

interface RecipeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeWithIngredients;
  onEdit?: (recipe: RecipeWithIngredients) => void;
  onDelete?: (recipeId: string) => Promise<void> | void;
}

export function RecipeDetailsDialog({
  open,
  onOpenChange,
  recipe,
  onEdit,
  onDelete,
}: RecipeDetailsDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;

  // Fetch materials for ingredient details
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials || [];

  // Calculate total cost from ingredients
  const calculateTotalCost = () => {
    let total = 0;
    recipe.ingredients.forEach((ingredient) => {
      const material = materials.find((m) => m.id === ingredient.materialId);
      if (material) {
        total += Number(material.unitCost) * ingredient.quantity;
      }
    });
    return total;
  };
  // Calculate cost per unit
  const calculateCostPerUnit = () => {
    const totalCost = calculateTotalCost();
    return totalCost / recipe.yieldQuantity;
  };

  // Calculate profit margin (assuming 2.5x markup)
  const calculateProfitMargin = () => {
    const costPerUnit = calculateCostPerUnit();
    const suggestedPrice = costPerUnit * 2.5;
    const profit = suggestedPrice - costPerUnit;
    const margin = (profit / suggestedPrice) * 100;
    return { suggestedPrice, profit, margin };
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(recipe.id);
      // setDeleteDialogOpen(false); // Handled by ConfirmationDialog
      // onOpenChange(false); // Handled by ConfirmationDialog or parent update
    }
  };

  const totalCost = calculateTotalCost();
  const costPerUnit = calculateCostPerUnit();
  const { suggestedPrice, profit, margin } = calculateProfitMargin();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px] [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{recipe.name}</DialogTitle>
                <DialogDescription className="mt-2">
                  {recipe.description || t("data.materials.noDescription")}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(recipe)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                    <ChefHat className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Yield</p>
                    <p className="font-semibold">
                      {recipe.yieldQuantity} {recipe.yieldUnit}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.form.productionTime")}
                    </p>
                    <p className="font-semibold">{formatDuration(recipe.productionTimeMinutes)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.details.costPerBatch") || "Cost per Batch"}
                    </p>
                    <p className="font-semibold">{formatPrice(totalCost)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Badge */}
            {recipe.category && (
              <div>
                <Badge variant="secondary" className="text-sm">
                  {getTranslatedCategory(recipe.category, t)}
                </Badge>
              </div>
            )}

            <Separator />

            {/* Ingredients Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Ingredients ({recipe.ingredients.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recipe.ingredients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
                    <AlertCircle className="mb-3 h-12 w-12 text-amber-600 dark:text-amber-500" />
                    <h3 className="mb-2 text-lg font-semibold text-amber-900 dark:text-amber-100">
                      {t("data.recipes.warnings.noIngredients.title") || "No Ingredients"}
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-md text-sm">
                      {t("data.recipes.warnings.noIngredients.description") ||
                        "This recipe doesn't have any ingredients yet. Add ingredients to calculate costs and use this recipe for production."}
                    </p>
                    {onEdit && (
                      <Button variant="outline" size="sm" onClick={() => onEdit(recipe)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t("data.recipes.warnings.noIngredients.action") || "Add Ingredients"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {recipe.ingredients.map((ingredient, index) => {
                        const material = materials.find((m) => m.id === ingredient.materialId);
                        const ingredientCost = material
                          ? Number(material.unitCost) * ingredient.quantity
                          : 0;

                        // Check if material was deleted
                        const isMaterialDeleted = !material;

                        return (
                          <div key={index}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`font-medium ${isMaterialDeleted ? "text-muted-foreground line-through" : ""}`}
                                  >
                                    {material?.name ||
                                      t("data.materials.deletedMaterial") ||
                                      "Deleted Material"}
                                  </p>
                                  {isMaterialDeleted && (
                                    <Badge variant="destructive" className="text-xs">
                                      {t("common.deleted") || "Deleted"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-muted-foreground text-sm">
                                  {ingredient.quantity} {ingredient.unit}
                                  {ingredient.notes && ` • ${ingredient.notes}`}
                                </p>
                                {material && (
                                  <p className="text-muted-foreground text-xs">
                                    {formatPrice(Number(material.unitCost))}/{material.unit} ×{" "}
                                    {ingredient.quantity} {ingredient.unit}
                                  </p>
                                )}
                                {isMaterialDeleted && (
                                  <p className="text-xs text-amber-600 dark:text-amber-500">
                                    {t("data.recipes.warnings.materialDeleted") ||
                                      "⚠️ This material has been deleted. Please update the recipe."}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-semibold ${isMaterialDeleted ? "text-muted-foreground" : ""}`}
                                >
                                  {formatPrice(ingredientCost)}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {totalCost > 0
                                    ? ((ingredientCost / totalCost) * 100).toFixed(1)
                                    : "0"}
                                  %
                                </p>
                              </div>
                            </div>
                            {index < recipe.ingredients.length - 1 && (
                              <Separator className="mt-3" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <Separator className="my-4" />

                    <div className="flex justify-between font-semibold">
                      <span>
                        {t("data.recipes.details.totalMaterialsCost") || "Total Materials Cost"}
                      </span>
                      <span>{formatPrice(totalCost)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Linked Products Section */}
            {recipe.recipeProducts && recipe.recipeProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Box className="h-5 w-5" />
                    {t("data.recipes.details.linkedProducts")?.replace(
                      "{count}",
                      recipe.recipeProducts.length.toString()
                    ) || `Linked Products (${recipe.recipeProducts.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recipe.recipeProducts.map((recipeProduct, index) => {
                      const product = recipeProduct.product;
                      return (
                        <div key={recipeProduct.id}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{product.name}</p>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {product.category && (
                                  <Badge variant="secondary" className="mr-2 text-xs">
                                    {product.category}
                                  </Badge>
                                )}
                                {product.sku && <span className="text-xs">SKU: {product.sku}</span>}
                              </p>
                              <div className="mt-1 flex items-center gap-4 text-xs">
                                <span className="text-muted-foreground">
                                  {t("common.stock")}: {formatNumber(Number(product.currentStock))}{" "}
                                  {product.unit}
                                </span>
                                <span className="text-muted-foreground">
                                  {t("alerts.price")}: {formatPrice(Number(product.sellingPrice))}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant={
                                  Number(product.currentStock) > Number(product.minStock)
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {Number(product.currentStock) > Number(product.minStock)
                                  ? t("common.stockStatus.inStock")
                                  : t("common.stockStatus.lowStock")}
                              </Badge>
                            </div>
                          </div>
                          {index < (recipe.recipeProducts?.length ?? 0) - 1 && (
                            <Separator className="mt-3" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-muted/50 mt-4 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.details.linkedProductsHint") ||
                        "💡 These products can be produced using this recipe. A product can be linked to multiple recipes (e.g., 10 baguettes or 50 baguettes)."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cost Analysis */}
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5" />
                  {t("data.recipes.details.costAnalysisPricing") || "Cost Analysis & Pricing"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.costPerUnit")?.replace("{unit}", recipe.yieldUnit) ||
                        `Cost per ${recipe.yieldUnit}`}
                    </p>
                    <p className="text-2xl font-bold">{formatPrice(costPerUnit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.suggestedPrice") || "Suggested Price (2.5x markup)"}
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatPrice(suggestedPrice)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("data.recipes.details.profitPerUnit")?.replace(
                        "{unit}",
                        recipe.yieldUnit
                      ) || `Profit per ${recipe.yieldUnit}`}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatPrice(profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("data.products.details.profitMargin") || "Profit Margin"}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("data.recipes.details.costBreakdown") || "Cost Breakdown"}
                    </span>
                    <span className="font-semibold">
                      {((costPerUnit / suggestedPrice) * 100).toFixed(1)}% COGS
                    </span>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    {t("data.recipes.details.pricingRecommendations") || "Pricing Recommendations"}
                  </div>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>
                      •{" "}
                      {t("data.recipes.details.wholesalePricing")?.replace(
                        "{price}",
                        formatPrice(costPerUnit * 1.43)
                      ) || `Wholesale (30% margin): ${formatPrice(costPerUnit * 1.43)}`}
                    </p>
                    <p>
                      •{" "}
                      {t("data.recipes.details.retailPricing")?.replace(
                        "{price}",
                        formatPrice(costPerUnit * 2.5)
                      ) || `Retail (60% margin): ${formatPrice(costPerUnit * 2.5)}`}
                    </p>
                    <p>
                      •{" "}
                      {t("data.recipes.details.premiumPricing")?.replace(
                        "{price}",
                        formatPrice(costPerUnit * 3.33)
                      ) || `Premium (70% margin): ${formatPrice(costPerUnit * 3.33)}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructions Section */}
            {recipe.instructions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="font-sans text-sm whitespace-pre-wrap">{recipe.instructions}</pre>
                </CardContent>
              </Card>
            )}

            {/* Production Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ChefHat className="h-5 w-5" />
                  {t("data.recipes.details.productionMetrics") || "Production Metrics"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.costPerMinute") || "Cost per Minute"}
                    </p>
                    <p className="font-semibold">
                      {formatPrice(totalCost / recipe.productionTimeMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.outputPerHour") || "Output per Hour"}
                    </p>
                    <p className="font-semibold">
                      {((60 / recipe.productionTimeMinutes) * recipe.yieldQuantity).toFixed(2)}{" "}
                      {recipe.yieldUnit}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.laborCost") || "Labor Cost (estimate)"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.details.laborCostEstimate") ||
                        `@ $15/hr: ${formatPrice((15 / 60) * recipe.productionTimeMinutes)}`}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.details.laborCostEstimate20")?.replace(
                        "{price}",
                        formatPrice((20 / 60) * recipe.productionTimeMinutes)
                      ) || `@ $20/hr: ${formatPrice((20 / 60) * recipe.productionTimeMinutes)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.details.breakEvenUnits") || "Break-even Units/Day"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("data.recipes.details.breakEvenWithOverhead")
                        ?.replace("{units}", Math.ceil(200 / profit).toString())
                        ?.replace("{unit}", recipe.yieldUnit) ||
                        `With $200 overhead: ${Math.ceil(200 / profit)} ${recipe.yieldUnit}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <div className="text-muted-foreground grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {t("data.materials.details.created") || "Created"}: {formatDate(recipe.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {t("data.materials.details.lastUpdated") || "Updated"}:{" "}
                  {formatDate(recipe.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t("data.recipes.deleteConfirm.title") || "Delete Recipe"}
        description={
          t("data.recipes.deleteConfirm.description")?.replace("{name}", recipe.name) ||
          `Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`
        }
        confirmText={t("actions.delete") || "Delete"}
        variant="destructive"
      />
    </>
  );
}
