"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Package, DollarSign, Calendar, Edit, Trash2, Star } from "lucide-react";
import { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatDate } from "@/lib/utils/format-date";

interface MaterialDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialWithSuppliers | null;
  onEdit?: (material: MaterialWithSuppliers) => void;
  onDelete?: (materialId: string) => Promise<void> | void;
}

// Helper functions
function getStockStatus(
  current: number,
  min: number,
  max: number,
  t: (key: string) => string
): string {
  if (current <= 0) return t("common.stockStatus.outOfStock");
  if (current <= min) return t("common.stockStatus.lowStock");
  if (current > max) return t("common.stockStatus.overstocked");
  return t("common.stockStatus.inStock");
}

function getStockStatusVariant(
  status: string,
  t: (key: string) => string
): "default" | "destructive" | "secondary" | "outline" {
  if (status === t("common.stockStatus.outOfStock")) return "destructive";
  if (status === t("common.stockStatus.lowStock")) return "outline";
  if (status === t("common.stockStatus.overstocked")) return "secondary";
  return "default";
}

function calculateStockPercentage(current: number, max: number): number {
  return Math.min((current / max) * 100, 100);
}

export function MaterialDetailsDialog({
  open,
  onOpenChange,
  material,
  onEdit,
  onDelete,
}: MaterialDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  if (!material) return null;

  const currentStock = Number(material.currentStock);
  const minStock = Number(material.minStock);
  const maxStock = Number(material.maxStock);
  const stockStatus = getStockStatus(currentStock, minStock, maxStock, t);
  const stockPercentage = calculateStockPercentage(currentStock, maxStock);

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(material.id);
      // setShowDeleteConfirm(false); // Handled by ConfirmationDialog
      // onOpenChange(false); // Handled by ConfirmationDialog or parent update
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(material);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px] [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-xl">{material.name}</DialogTitle>
                {material.sku && (
                  <p className="text-muted-foreground mt-1 text-sm">SKU: {material.sku}</p>
                )}
              </div>
              <Badge variant={getStockStatusVariant(stockStatus, t)}>{stockStatus}</Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stock Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  {t("data.materials.details.stockInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("data.materials.details.currentStock")}
                    </span>
                    <span className="font-medium">
                      {currentStock} {material.unit}
                    </span>
                  </div>
                  <Progress value={stockPercentage} className="h-2" />
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>
                      {t("data.materials.details.minStock")}: {minStock} {material.unit}
                    </span>
                    <span>
                      {t("data.materials.details.maxStock")}: {maxStock} {material.unit}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("data.materials.details.category")}
                    </p>
                    <p className="text-sm font-medium">
                      {material.category || t("common.uncategorized")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("data.materials.details.unit")}
                    </p>
                    <p className="text-sm font-medium">{material.unit}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Suppliers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  {t("data.materials.details.suppliers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!material.materialSuppliers || material.materialSuppliers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("data.materials.details.noSuppliersLinked")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {material.materialSuppliers.map((supplierLink) => (
                      <div
                        key={supplierLink.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          {supplierLink.isPreferred && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                          <span className="font-medium">{supplierLink.supplier.name}</span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {formatPrice(Number(supplierLink.price))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  {t("data.materials.details.pricing")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.materials.details.unitCost")}
                    </span>
                    <span className="font-medium">
                      {formatPrice(
                        Number(material.unitCost) * Number(material.purchaseQuantity ?? 1)
                      )}
                      {Number(material.purchaseQuantity ?? 1) !== 1 && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          / {Number(material.purchaseQuantity)} {material.unit}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("data.materials.details.totalValue")}
                    </span>
                    <span className="font-medium">
                      {formatPrice(Number(material.unitCost) * currentStock)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {material.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("data.materials.details.description")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{material.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  {t("data.materials.details.metadata")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("data.materials.details.created")}
                    </span>
                    <span>{formatDate(material.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("data.materials.details.lastUpdated")}
                    </span>
                    <span>{formatDate(material.updatedAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="mr-1 hidden h-4 w-4 sm:inline" />
              {t("common.actions.edit")}
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
              {t("common.actions.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title={t("data.materials.deleteConfirm.title")}
        description={
          t("data.materials.deleteConfirm.description")?.replace("{name}", material.name) || ""
        }
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
      />
    </>
  );
}
