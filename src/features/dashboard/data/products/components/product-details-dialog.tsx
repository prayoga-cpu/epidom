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
} from "lucide-react";
import type { ProductWithRelations } from "@/lib/repositories/product.repository";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/formatting";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

interface ProductDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithRelations;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ProductDetailsDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onDelete,
}: ProductDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useI18n();
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

    if (!currentStock && currentStock !== 0) return "Unknown";
    if (currentStock === 0) return "Out of Stock";
    if (minStock && currentStock < minStock * 0.5) return "Critical";
    if (minStock && currentStock <= minStock) return "Low Stock";
    if (maxStock && currentStock >= maxStock) return "Overstocked";
    return "In Stock";
  };

  // Get stock status color
  const getStockStatusColor = () => {
    const status = getStockStatus();
    switch (status) {
      case "Out of Stock":
      case "Critical":
        return "destructive";
      case "Low Stock":
        return "default";
      case "Overstocked":
        return "default";
      case "In Stock":
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
                  <Edit className="mr-2 h-4 w-4" />
                  {t("actions.edit") || "Edit"}
                </Button>
              )}
              {onDelete && (
                <ConfirmationDialog
                  open={showDeleteConfirm}
                  onOpenChange={setShowDeleteConfirm}
                  title="Delete Product"
                  description={`Are you sure you want to delete "${product.name}"? This action cannot be undone.`}
                  confirmText="Delete Product"
                  onConfirm={onDelete}
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
                <CardTitle className="text-sm font-medium">Stock</CardTitle>
                <Package className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(Number(product.currentStock) || 0)}
                </div>
                <p className="text-muted-foreground text-xs">{product.unit}</p>
                <Badge variant={getStockStatusColor() as any} className="mt-2 text-xs">
                  {stockStatus}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retail Price</CardTitle>
                <DollarSign className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(Number(product.sellingPrice) || 0)}
                </div>
                <p className="text-muted-foreground text-xs">per {product.unit}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
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
                <p className="text-muted-foreground text-xs">on retail sales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
                <BarChart3 className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stockValue)}</div>
                <p className="text-muted-foreground text-xs">at cost price</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Basic Information */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Tag className="h-5 w-5" />
              Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">SKU</label>
                  <p className="text-sm">{product.sku || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Category</label>
                  <p className="text-sm">
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : (
                      "N/A"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Unit</label>
                  <p className="text-sm">{product.unit || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recipe Information */}
          {product.recipe && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ChefHat className="h-5 w-5" />
                  Recipe Information
                </h3>
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div>
                        <label className="text-muted-foreground text-sm font-medium">
                          Recipe Name
                        </label>
                        <p className="mt-1 text-base font-semibold">{product.recipe.name}</p>
                      </div>
                      {product.recipe.description && (
                        <div>
                          <label className="text-muted-foreground text-sm font-medium">
                            Description
                          </label>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {product.recipe.description}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Category: </span>
                          <Badge variant="outline">{product.recipe.category}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Yield: </span>
                          <span className="font-medium">
                            {formatNumber(Number(product.recipe.yieldQuantity))}{" "}
                            {product.recipe.yieldUnit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Separator />

          {/* Stock Information */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5" />
              Stock Information
            </h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Current Stock</label>
                  <p className="text-lg font-semibold">
                    {formatNumber(Number(product.currentStock) || 0)} {product.unit}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Minimum Stock</label>
                  <p className="text-lg font-semibold">
                    {product.minStock !== undefined
                      ? `${formatNumber(Number(product.minStock))} ${product.unit}`
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Maximum Stock</label>
                  <p className="text-lg font-semibold">
                    {product.maxStock !== undefined
                      ? `${formatNumber(Number(product.maxStock))} ${product.unit}`
                      : "Not set"}
                  </p>
                </div>
              </div>

              {/* Stock Level Progress Bar */}
              {product.minStock !== undefined && product.maxStock !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stock Level</span>
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
                        stockStatus === "Critical" || stockStatus === "Out of Stock"
                          ? "bg-destructive"
                          : stockStatus === "Low Stock"
                            ? "bg-orange-500"
                            : stockStatus === "Overstocked"
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
              {(stockStatus === "Critical" ||
                stockStatus === "Low Stock" ||
                stockStatus === "Overstocked") && (
                <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      {stockStatus === "Critical" &&
                        "⚠️ Critical stock level! Immediate restocking required."}
                      {stockStatus === "Low Stock" &&
                        "⚠️ Stock is running low. Consider restocking soon."}
                      {stockStatus === "Overstocked" &&
                        "ℹ️ Stock level exceeds maximum. Consider promotions or adjusting production."}
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
              Pricing & Financial Analysis
            </h3>
            <div className="space-y-4">
              {/* Pricing Breakdown */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Cost Price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatCurrency(Number(product.costPrice) || 0)}
                    </p>
                    <p className="text-muted-foreground text-xs">per {product.unit}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Selling Price</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatCurrency(Number(product.sellingPrice) || 0)}
                    </p>
                    <p className="text-muted-foreground text-xs">per {product.unit}</p>
                    <p className="mt-1 text-xs font-medium text-green-600">
                      {retailMargin.toFixed(1)}% margin
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Stock Value (at cost):</span>
                    <span className="font-semibold">{formatCurrency(stockValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Potential Revenue (retail):
                    </span>
                    <span className="font-semibold">{formatCurrency(potentialRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Potential Profit:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(potentialRevenue - stockValue)}
                    </span>
                  </div>
                  {product.sellingPrice && product.costPrice && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-muted-foreground text-sm">Profit per unit:</span>
                      <span className="font-semibold">
                        {formatCurrency(
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
              <span>Created: {formatDate(product.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Updated: {formatDate(product.updatedAt)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
