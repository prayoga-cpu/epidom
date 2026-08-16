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
import { Progress } from "@/components/ui/progress";
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
  ListChecks,
} from "lucide-react";
import type { ProductWithRelations } from "@/lib/repositories/product.repository";
import { formatCurrency, formatNumber } from "@/lib/utils/formatting";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { getTranslatedCategory } from "../../recipes/utils/category-helpers";
import { useMaterials } from "../../materials/hooks/use-materials";

/**
 * Stock states this dialog can report. `not_counted` and `oversold` come
 * first because they short-circuit the threshold arithmetic entirely — see
 * `getStockStatusKey` below.
 */
type ProductStockStatus =
  | "not_counted"
  | "oversold"
  | "out_of_stock"
  | "critical"
  | "low_stock"
  | "overstocked"
  | "in_stock";

const STOCK_STATUS_VARIANT: Record<
  ProductStockStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_counted: "secondary",
  oversold: "destructive",
  out_of_stock: "destructive",
  critical: "destructive",
  low_stock: "default",
  overstocked: "default",
  in_stock: "default",
};

interface ProductDetailsDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithRelations;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
}

export function ProductDetailsDialog({
  storeId,
  open,
  onOpenChange,
  product,
  onEdit,
  onDelete,
}: ProductDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t, formatDate } = useI18n();
  const { formatPrice } = useCurrency();
  // Only the material's name/unit are needed to label an option's stock
  // linkage — the option itself already carries materialId/materialQty.
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials ?? [];

  // New keys ship in a separate locale change; `t()` echoes the key back when
  // it is missing, so fall back to English rather than render a raw key path.
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const currentStock = Number(product.currentStock) || 0;
  // Only BATCH_PRODUCED products carry a counted finished-goods balance.
  // MADE_TO_ORDER draws raw materials per sale and UNTRACKED never moves, so
  // `currentStock` on those rows is not a quantity anyone maintains — every
  // number derived from it (status, valuation, revenue) is suppressed below
  // rather than presented as fact.
  const isCounted = product.stockMode === "BATCH_PRODUCED";
  // A negative balance means the store sold stock it did not have. Sale-path
  // clamps were removed on purpose, so this is the honest record.
  const isOversold = isCounted && currentStock < 0;

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

  // Stock value at cost — `null` when no balance is counted, so the UI can
  // omit the figure instead of printing a confident "0".
  const calculateStockValue = (): number | null => {
    if (!isCounted) return null;
    return currentStock * (Number(product.costPrice) || 0);
  };

  // Potential revenue — same suppression rule as the valuation.
  const calculatePotentialRevenue = (): number | null => {
    if (!isCounted) return null;
    return currentStock * (Number(product.sellingPrice) || 0);
  };

  // Get stock status
  const getStockStatusKey = (): ProductStockStatus => {
    if (!isCounted) return "not_counted";

    const minStock = Number(product.minStock) || 0;
    const maxStock = Number(product.maxStock) || 0;

    if (currentStock < 0) return "oversold";
    if (currentStock === 0) return "out_of_stock";
    if (minStock && currentStock < minStock * 0.5) return "critical";
    if (minStock && currentStock <= minStock) return "low_stock";
    if (maxStock && currentStock >= maxStock) return "overstocked";
    return "in_stock";
  };

  const getStockStatusLabel = (status: ProductStockStatus): string => {
    const labels: Record<ProductStockStatus, string> = {
      not_counted: tr("data.products.stockStatus.notCounted", "Not counted"),
      oversold: tr("data.products.stockStatus.oversold", "Oversold"),
      out_of_stock: t("common.stockStatus.outOfStock"),
      critical: t("common.stockStatus.critical"),
      low_stock: t("common.stockStatus.lowStock"),
      overstocked: t("common.stockStatus.overstocked"),
      in_stock: t("common.stockStatus.inStock"),
    };
    return labels[status];
  };

  const { retailMargin } = calculateMargins();
  const stockValue = calculateStockValue();
  const potentialRevenue = calculatePotentialRevenue();
  const stockStatus = getStockStatusKey();
  const stockStatusLabel = getStockStatusLabel(stockStatus);
  // Potential profit only exists when both sides of it exist.
  const potentialProfit =
    stockValue === null || potentialRevenue === null ? null : potentialRevenue - stockValue;
  const maxStockNum = Number(product.maxStock) || 0;
  const stockLevelPercent = maxStockNum > 0 ? (currentStock / maxStockNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(90dvh/var(--app-zoom,1))] overflow-x-hidden overflow-y-auto sm:max-w-3xl [&>button]:hidden">
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
                {isCounted ? (
                  <>
                    <div
                      className={`text-2xl font-bold ${isOversold ? "text-destructive" : ""}`}
                    >
                      {formatNumber(currentStock)}
                    </div>
                    <p className="text-muted-foreground text-xs">{product.unit}</p>
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground text-2xl font-bold">&mdash;</div>
                    <p className="text-muted-foreground text-xs">
                      {tr(
                        "data.products.stockStatus.notCounted",
                        "No counted balance for this product"
                      )}
                    </p>
                  </>
                )}
                <Badge variant={STOCK_STATUS_VARIANT[stockStatus]} className="mt-2 text-xs">
                  {stockStatusLabel}
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
                {stockValue === null ? (
                  /* Nothing is counted, so there is no inventory to value. */
                  <>
                    <div className="text-muted-foreground text-2xl font-bold">&mdash;</div>
                    <p className="text-muted-foreground text-xs">
                      {tr("data.products.stockStatus.notCounted", "Not counted")}
                    </p>
                  </>
                ) : stockValue < 0 ? (
                  /* An oversold balance is not a negative asset — it is money
                     already lost against stock that was never there. */
                  <>
                    <div className="text-destructive text-2xl font-bold">
                      −{formatPrice(Math.abs(stockValue))}
                    </div>
                    <p className="text-destructive text-xs">
                      {tr("data.products.stockStatus.oversold", "Oversold")}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatPrice(stockValue)}</div>
                    <p className="text-muted-foreground text-xs">
                      {t("data.products.details.atCostPrice") || "at cost price"}
                    </p>
                  </>
                )}
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
            <div className="grid gap-4 sm:grid-cols-3">
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
                                  {recipe.category
                                    ? getTranslatedCategory(recipe.category, t)
                                    : t("common.notAvailable")}
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

          {/* Option Groups (variants like Size or Sugar Level) */}
          {product.optionGroups && product.optionGroups.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ListChecks className="h-5 w-5" />
                  {t("data.products.sections.options")} ({product.optionGroups.length})
                </h3>
                <div className="space-y-3">
                  {product.optionGroups.map((group) => (
                    <Card key={group.id} className="bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-base font-semibold">{group.name}</p>
                          <div className="flex items-center gap-2">
                            {group.isRequired && (
                              <Badge variant="outline">
                                {t("data.products.options.required")}
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              {t("data.products.options.maxSelections")}: {group.maxSelections}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.options.map((option) => {
                            const material = materials.find((m) => m.id === option.materialId);
                            const priceAdjustment = Number(option.priceAdjustment) || 0;
                            return (
                              <div
                                key={option.id}
                                className="bg-background min-w-0 space-y-1 rounded-md border p-2 text-sm"
                              >
                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                  <span className="min-w-0 font-medium break-words">
                                    {option.name}
                                  </span>
                                  {priceAdjustment !== 0 && (
                                    <span className="text-muted-foreground shrink-0 text-xs">
                                      +{formatPrice(priceAdjustment)}
                                    </span>
                                  )}
                                </div>
                                {material ? (
                                  <p className="text-muted-foreground min-w-0 text-xs break-words">
                                    {material.name} −{formatNumber(Number(option.materialQty) || 0)}{" "}
                                    {material.unit}
                                  </p>
                                ) : (
                                  <p className="text-muted-foreground text-xs">
                                    {t("data.products.options.noMaterial")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                  {isCounted ? (
                    <p
                      className={`text-lg font-semibold ${isOversold ? "text-destructive" : ""}`}
                    >
                      {formatNumber(currentStock)} {product.unit}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-lg font-semibold">&mdash;</p>
                  )}
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

              {/* Stock Level Progress Bar — only meaningful for a counted balance */}
              {isCounted && Number(product.maxStock) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("alerts.detailsDialog.stockLevel") || "Stock Level"}
                    </span>
                    {/* The number stays honest (it can be negative); only the
                        bar below is clamped, because a bar cannot draw one. */}
                    <span className={`font-medium ${isOversold ? "text-destructive" : ""}`}>
                      {stockLevelPercent.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.max(0, Math.min(100, stockLevelPercent))}
                    className={`h-2 ${
                      stockStatus === "oversold" ||
                      stockStatus === "critical" ||
                      stockStatus === "out_of_stock"
                        ? "[&>div]:bg-destructive"
                        : stockStatus === "low_stock"
                          ? "[&>div]:bg-orange-500"
                          : stockStatus === "overstocked"
                            ? "[&>div]:bg-blue-500"
                            : "[&>div]:bg-primary"
                    }`}
                  />
                </div>
              )}

              {/* Oversold Alert — a sale drew stock that was never there */}
              {stockStatus === "oversold" && (
                <Card className="border-destructive/40 bg-destructive/10">
                  <CardContent className="pt-4">
                    <p className="text-destructive text-sm font-semibold">
                      {tr("alerts.negativeStock.title", "Negative stock")}
                    </p>
                    <p className="text-destructive mt-1 text-sm">
                      {tr(
                        "alerts.negativeStock.body",
                        "{name} is showing {count} below zero. Count what's really there and correct it."
                      )
                        .replace("{name}", product.name)
                        .replace(
                          "{count}",
                          `${formatNumber(Math.abs(currentStock))} ${product.unit}`
                        )}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stock Alerts */}
              {(stockStatus === "critical" ||
                stockStatus === "low_stock" ||
                stockStatus === "overstocked") && (
                <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      {stockStatus === "critical" &&
                        (t("data.products.details.criticalStockAlert") ||
                          "⚠️ Critical stock level! Immediate restocking required.")}
                      {stockStatus === "low_stock" &&
                        (t("data.products.details.lowStockAlert") ||
                          "⚠️ Stock is running low. Consider restocking soon.")}
                      {stockStatus === "overstocked" &&
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
                  {/* Every figure here is `currentStock × price`. With no
                      counted balance there is no figure to state, and with a
                      negative one it is a loss, not an asset. */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.stockValueAtCost") || "Stock Value (at cost):"}
                    </span>
                    {stockValue === null ? (
                      <span className="text-muted-foreground font-semibold">&mdash;</span>
                    ) : (
                      <span
                        className={`font-semibold ${stockValue < 0 ? "text-destructive" : ""}`}
                      >
                        {stockValue < 0
                          ? `−${formatPrice(Math.abs(stockValue))}`
                          : formatPrice(stockValue)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.potentialRevenue") || "Potential Revenue (retail):"}
                    </span>
                    {potentialRevenue === null ? (
                      <span className="text-muted-foreground font-semibold">&mdash;</span>
                    ) : (
                      <span
                        className={`font-semibold ${potentialRevenue < 0 ? "text-destructive" : ""}`}
                      >
                        {potentialRevenue < 0
                          ? `−${formatPrice(Math.abs(potentialRevenue))}`
                          : formatPrice(potentialRevenue)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.products.details.potentialProfit") || "Potential Profit:"}
                    </span>
                    {potentialProfit === null ? (
                      <span className="text-muted-foreground font-semibold">&mdash;</span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          potentialProfit < 0 ? "text-destructive" : "text-green-600"
                        }`}
                      >
                        {potentialProfit < 0
                          ? `−${formatPrice(Math.abs(potentialProfit))}`
                          : formatPrice(potentialProfit)}
                      </span>
                    )}
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
