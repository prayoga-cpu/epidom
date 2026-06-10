"use client";

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
  TrendingUp,
  BarChart3,
  Edit,
  Tag,
  Calendar,
  ChefHat,
  AlertCircle,
} from "lucide-react";
import type { ProductWithRelations } from "@/lib/repositories/product.repository";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/formatting";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { SerializeDecimal } from "@/types/prisma";
import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { getTranslatedCategory } from "../../recipes/utils/category-helpers";

interface ProductDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: SerializeDecimal<ProductWithRelations>;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
}

export function ProductDetailsDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onDelete,
}: ProductDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  // Calculate profit margins
  const calculateMargins = () => {
    const sellingPrice = Number(product.sellingPrice) || 0;
    const costPrice = Number(product.costPrice) || 0;

    if (!sellingPrice || !costPrice) {
      return { retailMargin: 0 };
    }
    const retailMargin = ((sellingPrice - costPrice) / sellingPrice) * 100;
    return { retailMargin };
  };

  // Calculate stock value
  const calculateStockValue = () => {
    const currentStock = Number(product.currentStock) || 0;
    const costPrice = Number(product.costPrice) || 0;
    if (!currentStock) return 0;
    return currentStock * costPrice;
  };

  // Calculate potential revenue
  const calculatePotentialRevenue = () => {
    const currentStock = Number(product.currentStock) || 0;
    const sellingPrice = Number(product.sellingPrice) || 0;
    if (!currentStock || !sellingPrice) return 0;
    return currentStock * sellingPrice;
  };

  // Get stock status
  const getStockStatus = () => {
    const currentStock = Number(product.currentStock) || 0;
    const minStock = Number(product.minStock) || 0;
    const maxStock = Number(product.maxStock) || 0;

    if (!currentStock && currentStock !== 0) return t("common.stockStatus.unknown") || "Unknown";
    if (currentStock === 0) return t("common.stockStatus.outOfStock");
    if (minStock && currentStock < minStock * 0.5)
      return t("common.stockStatus.critical") || "Critical";
    if (minStock && currentStock <= minStock) return t("common.stockStatus.lowStock");
    if (maxStock && currentStock >= maxStock) return t("common.stockStatus.overstocked");
    return t("common.stockStatus.inStock");
  };

  // Get stock status color
  const getStockStatusColor = () => {
    const status = getStockStatus();
    const outOfStock = t("common.stockStatus.outOfStock");
    const critical = t("common.stockStatus.critical") || "Critical";
    const lowStock = t("common.stockStatus.lowStock");
    const overstocked = t("common.stockStatus.overstocked");
    const inStock = t("common.stockStatus.inStock");

    switch (status) {
      case outOfStock:
      case critical:
        return "destructive";
      case lowStock:
        return "default";
      case overstocked:
        return "default";
      case inStock:
        return "default";
      default:
        return "secondary";
    }
  };

  const { retailMargin } = calculateMargins();
  const stockValue = calculateStockValue();
  const potentialRevenue = calculatePotentialRevenue();
  const stockStatus = getStockStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl">{product.name}</DialogTitle>
              <DialogDescription>
                {product.description || "Product details and information"}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("actions.edit") || "Edit"}
                </Button>
              )}
              {onDelete && (
                <ConfirmationDialog
                  open={showDeleteConfirm}
                  onOpenChange={setShowDeleteConfirm}
                  title={t("data.products.deleteConfirm.title") || "Delete Product"}
                  description={
                    t("data.products.deleteConfirm.description")?.replace("{name}", product.name) ||
                    `Are you sure you want to delete "${product.name}"? This action cannot be undone.`
                  }
                  confirmText={t("data.products.deleteConfirm.title") || "Delete Product"}
                  onConfirm={async () => {
                    if (onDelete) await onDelete();
                  }}
                  variant="destructive"
                />
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("common.stock")}</CardTitle>
                <Package className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(Number(product.currentStock) || 0)}
                </div>
                <p className="text-muted-foreground text-xs">{product.unit}</p>
                {/**
                 * Type assertion needed because Badge variant type doesn't include all possible values
                 * Actual type: "default" | "secondary" | "destructive" | "outline"
                 * TODO: Update Badge component to accept all variant types or use type guard
                 */}
                <Badge variant={getStockStatusColor() as any} className="mt-2 text-xs">
                  {stockStatus}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("data.products.form.retailPrice")}
                </CardTitle>
                <DollarSign className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPrice(Number(product.sellingPrice) || 0)}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("common.per")} {product.unit}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("data.products.details.profitMargin") || "Profit Margin"}
                </CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    retailMargin >= 50
                      ? "text-green-600"
                      : retailMargin >= 30
                        ? "text-blue-600"
                        : "text-orange-600"
                  }`}
                >
                  {retailMargin.toFixed(1)}%
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("data.products.details.onRetailSales") || "on retail sales"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("data.materials.details.totalValue") || "Stock Value"}
                </CardTitle>
                <BarChart3 className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(stockValue)}</div>
                <p className="text-muted-foreground text-xs">
                  {t("data.products.details.atCostPrice") || "at cost price"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Basic Information */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Tag className="h-5 w-5" />
              {t("data.products.sections.basicInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">SKU</label>
                  <p className="text-sm">{product.sku || t("common.notAvailable")}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    {t("data.products.form.category")}
                  </label>
                  <p className="text-sm">
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : (
                      t("common.notAvailable")
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    {t("data.products.form.unit")}
                  </label>
                  <p className="text-sm">{product.unit || t("common.notAvailable")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recipe Information */}
          {product.recipeProducts && product.recipeProducts.length > 0 ? (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ChefHat className="h-5 w-5" />
                  {t("data.products.form.linkedRecipes")} ({product.recipeProducts.length})
                </h3>
                <div className="space-y-3">
                  {product.recipeProducts.map((recipeProduct) => {
                    const recipe = recipeProduct.recipe;
                    return (
                      <Card key={recipeProduct.id} className="bg-muted/30">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="text-muted-foreground text-sm font-medium">
                                  {t("data.recipes.form.name")}
                                </label>
                                <p className="mt-1 text-base font-semibold">{recipe.name}</p>
                              </div>
                            </div>
                            {recipe.description && (
                              <div>
                                <label className="text-muted-foreground text-sm font-medium">
                                  {t("data.recipes.form.description")}
                                </label>
                                <p className="text-muted-foreground mt-1 text-sm">
                                  {recipe.description}
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">
                                  {t("data.recipes.form.category")}:{" "}
                                </span>
                                <Badge variant="outline">
                                  {recipe.category ? getTranslatedCategory(recipe.category, t) : t("common.notAvailable")}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  {t("data.recipes.cards.yield")}:{" "}
                                </span>
                                <span className="font-medium">
                                  {formatNumber(Number(recipe.yieldQuantity))} {recipe.yieldUnit}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ChefHat className="h-5 w-5" />
                  {t("data.products.form.linkedRecipes")}
                </h3>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-8 text-center dark:border-blue-700 dark:bg-blue-950/30">
                  <AlertCircle className="mb-3 h-12 w-12 text-blue-600 dark:text-blue-500" />
                  <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {t("data.products.warnings.noRecipes.title") || "No Linked Recipes"}
                  </h3>
                  <p className="text-muted-foreground mb-4 max-w-md text-sm">
                    {t("data.products.warnings.noRecipes.description") ||
                      "This product doesn't have any linked recipes yet. Link a recipe to enable production planning and cost tracking."}
                  </p>
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t("data.products.warnings.noRecipes.action") || "Link Recipe"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Stock Information */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5" />
              {t("data.materials.details.stockInfo")}
            </h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    {t("data.products.form.currentStock")}
                  </label>
                  <p className="text-lg font-semibold">
                    {formatNumber(Number(product.currentStock) || 0)} {product.unit}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    {t("data.products.form.minStock")}
                  </label>
                  <p className="text-lg font-semibold">
                    {product.minStock !== undefined
                      ? `${formatNumber(Number(product.minStock))} ${product.unit}`
                      : t("common.notAvailable")}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    {t("data.products.form.maxStock")}
                  </label>
                  <p className="text-lg font-semibold">
                    {product.maxStock !== undefined
                      ? `${formatNumber(Number(product.maxStock))} ${product.unit}`
                      : t("common.notAvailable")}
                  </p>
                </div>
              </div>

              {/* Stock Level Progress Bar */}
              {product.minStock !== undefined && product.maxStock !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("alerts.detailsDialog.stockLevel") || "Stock Level"}
                    </span>
                    <span className="font-medium">
                      {(
                        ((Number(product.currentStock) || 0) / Number(product.maxStock)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full transition-all ${
                        stockStatus === t("common.stockStatus.critical") ||
                        stockStatus === t("common.stockStatus.outOfStock")
                          ? "bg-destructive"
                          : stockStatus === t("common.stockStatus.lowStock")
                            ? "bg-orange-500"
                            : stockStatus === t("common.stockStatus.overstocked")
                              ? "bg-blue-500"
                              : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(100, ((Number(product.currentStock) || 0) / Number(product.maxStock)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Stock Alerts */}
              {(stockStatus === t("common.stockStatus.critical") ||
                stockStatus === t("common.stockStatus.lowStock") ||
                stockStatus === t("common.stockStatus.overstocked")) && (
                <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      {stockStatus === t("common.stockStatus.critical") &&
                        (t("data.products.details.criticalStockAlert") ||
                          "⚠️ Critical stock level! Immediate restocking required.")}
                      {stockStatus === t("common.stockStatus.lowStock") &&
                        (t("data.products.details.lowStockAlert") ||
                          "⚠️ Stock is running low. Consider restocking soon.")}
                      {stockStatus === t("common.stockStatus.overstocked") &&
                        (t("data.products.details.overstockedAlert") ||
                          "ℹ️ Stock level exceeds maximum. Consider promotions or adjusting production.")}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Separator />

          {/* Pricing & Financial Analysis */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <DollarSign className="h-5 w-5" />
              {t("data.products.details.pricingFinancial") || "Pricing & Financial Analysis"}
            </h3>
            <div className="space-y-4">
              {/* Pricing Breakdown */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {t("data.products.form.costPrice")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatPrice(Number(product.costPrice) || 0)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("common.per")} {product.unit}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {t("data.products.details.sellingPrice") || "Selling Price"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatPrice(Number(product.sellingPrice) || 0)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("common.per")} {product.unit}
                    </p>
                    <p className="mt-1 text-xs font-medium text-green-600">
                      {retailMargin.toFixed(1)}% {t("data.products.details.margin") || "margin"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {t("data.products.details.financialSummary") || "Financial Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.stockValueAtCost") || "Stock Value (at cost):"}
                    </span>
                    <span className="font-semibold">{formatPrice(stockValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.potentialRevenue") || "Potential Revenue (retail):"}
                    </span>
                    <span className="font-semibold">{formatPrice(potentialRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.potentialProfit") || "Potential Profit:"}
                    </span>
                    <span className="font-semibold text-green-600">
                      {formatPrice(potentialRevenue - stockValue)}
                    </span>
                  </div>
                  {product.sellingPrice && product.costPrice && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-muted-foreground text-sm">
                        {t("data.products.details.profitPerUnit") || "Profit per unit:"}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(
                          (Number(product.sellingPrice) || 0) - (Number(product.costPrice) || 0)
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Metadata */}
          <Separator />
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {t("data.materials.details.created") || "Created"}: {formatDate(product.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {t("data.materials.details.lastUpdated") || "Updated"}:{" "}
                {formatDate(product.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
