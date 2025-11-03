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
} from "lucide-react";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils/formatting";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { useMaterials } from "../../materials/hooks/use-materials";
import type { RecipeWithIngredients } from "../hooks/use-recipes";

interface RecipeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeWithIngredients;
  onEdit?: (recipe: RecipeWithIngredients) => void;
  onDelete?: (recipeId: string) => void;
}

export default function RecipeDetailsDialog({
  open,
  onOpenChange,
  recipe,
  onEdit,
  onDelete,
}: RecipeDetailsDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { t } = useI18n();
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

  const handleDelete = () => {
    if (onDelete) {
      onDelete(recipe.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
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
                  {recipe.description || "No description provided"}
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
                    <p className="text-muted-foreground text-xs">Production Time</p>
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
                    <p className="text-muted-foreground text-xs">Cost per Batch</p>
                    <p className="font-semibold">{formatCurrency(totalCost)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Badge */}
            {recipe.category && (
              <div>
                <Badge variant="secondary" className="text-sm">
                  {recipe.category}
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
                <div className="space-y-3">
                  {recipe.ingredients.map((ingredient, index) => {
                    const material = materials.find((m) => m.id === ingredient.materialId);
                    const ingredientCost = material
                      ? Number(material.unitCost) * ingredient.quantity
                      : 0;

                    return (
                      <div key={index}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{material?.name || "Unknown Material"}</p>
                            <p className="text-muted-foreground text-sm">
                              {ingredient.quantity} {ingredient.unit}
                              {ingredient.notes && ` • ${ingredient.notes}`}
                            </p>
                            {material && (
                              <p className="text-muted-foreground text-xs">
                                {formatCurrency(Number(material.unitCost))}/{material.unit} ×{" "}
                                {ingredient.quantity} {ingredient.unit}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(ingredientCost)}</p>
                            <p className="text-muted-foreground text-xs">
                              {totalCost > 0
                                ? ((ingredientCost / totalCost) * 100).toFixed(1)
                                : "0"}
                              %
                            </p>
                          </div>
                        </div>
                        {index < recipe.ingredients.length - 1 && <Separator className="mt-3" />}
                      </div>
                    );
                  })}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between font-semibold">
                  <span>Total Materials Cost</span>
                  <span>{formatCurrency(totalCost)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost Analysis */}
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5" />
                  Cost Analysis & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">Cost per {recipe.yieldUnit}</p>
                    <p className="text-2xl font-bold">{formatCurrency(costPerUnit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Suggested Price (2.5x markup)</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(suggestedPrice)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit per {recipe.yieldUnit}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost Breakdown</span>
                    <span className="font-semibold">
                      {((costPerUnit / suggestedPrice) * 100).toFixed(1)}% COGS
                    </span>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Pricing Recommendations
                  </div>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>• Wholesale (30% margin): {formatCurrency(costPerUnit * 1.43)}</p>
                    <p>• Retail (60% margin): {formatCurrency(costPerUnit * 2.5)}</p>
                    <p>• Premium (70% margin): {formatCurrency(costPerUnit * 3.33)}</p>
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
                  Production Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">Cost per Minute</p>
                    <p className="font-semibold">
                      {formatCurrency(totalCost / recipe.productionTimeMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Output per Hour</p>
                    <p className="font-semibold">
                      {((60 / recipe.productionTimeMinutes) * recipe.yieldQuantity).toFixed(2)}{" "}
                      {recipe.yieldUnit}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Labor Cost (estimate)</p>
                    <p className="text-muted-foreground text-xs">
                      @ $15/hr: {formatCurrency((15 / 60) * recipe.productionTimeMinutes)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      @ $20/hr: {formatCurrency((20 / 60) * recipe.productionTimeMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Break-even Units/Day</p>
                    <p className="text-muted-foreground text-xs">
                      With $200 overhead: {Math.ceil(200 / profit)} {recipe.yieldUnit}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <div className="text-muted-foreground grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Created: {formatDate(recipe.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Updated: {formatDate(recipe.updatedAt)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Recipe"
        description={`Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
