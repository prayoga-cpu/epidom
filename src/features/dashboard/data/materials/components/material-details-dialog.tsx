"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Package, DollarSign, Calendar, Edit, Trash2, Star } from "lucide-react";
import { Material } from "@/types/entities";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useI18n } from "@/components/lang/i18n-provider";

interface MaterialDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onEdit?: (material: Material) => void;
  onDelete?: (materialId: string) => void;
}

// Helper functions
function getStockStatus(current: number, min: number, max: number): string {
  if (current <= 0) return "Out of Stock";
  if (current <= min) return "Low Stock";
  if (current > max) return "Overstocked";
  return "In Stock";
}

function getStockStatusVariant(
  status: string
): "default" | "destructive" | "secondary" | "outline" {
  if (status === "Out of Stock") return "destructive";
  if (status === "Low Stock") return "outline";
  if (status === "Overstocked") return "secondary";
  return "default";
}

function calculateStockPercentage(current: number, max: number): number {
  return Math.min((current / max) * 100, 100);
}

interface MaterialDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onEdit?: (material: Material) => void;
  onDelete?: (materialId: string) => void;
}

export default function MaterialDetailsDialog({
  open,
  onOpenChange,
  material,
  onEdit,
  onDelete,
}: MaterialDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useI18n();

  if (!material) return null;

  const currentStock = Number(material.currentStock);
  const minStock = Number(material.minStock);
  const maxStock = Number(material.maxStock);
  const stockStatus = getStockStatus(currentStock, minStock, maxStock);
  const stockPercentage = calculateStockPercentage(currentStock, maxStock);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(material.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
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
              <Badge variant={getStockStatusVariant(stockStatus)}>{stockStatus}</Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stock Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  {t("data.materials.details.stockInfo") || "Stock Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Stock</span>
                    <span className="font-medium">
                      {currentStock} {material.unit}
                    </span>
                  </div>
                  <Progress value={stockPercentage} className="h-2" />
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>
                      Min: {minStock} {material.unit}
                    </span>
                    <span>
                      Max: {maxStock} {material.unit}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Category</p>
                    <p className="text-sm font-medium">{material.category || "Uncategorized"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Unit</p>
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
                  {t("data.materials.details.suppliers") || "Suppliers"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {material.ingredientSuppliers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No suppliers linked</p>
                ) : (
                  <div className="space-y-2">
                    {material.ingredientSuppliers.map((supplierLink) => (
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
                          ${Number(supplierLink.price).toFixed(2)}
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
                  {t("data.materials.details.pricing") || "Pricing"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Unit Cost</span>
                    <span className="font-medium">${Number(material.unitCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Total Value</span>
                    <span className="font-medium">
                      ${(Number(material.unitCost) * currentStock).toFixed(2)}
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
                    {t("data.materials.details.description") || "Description"}
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
                  {t("data.materials.details.metadata") || "Information"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(material.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{new Date(material.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              {t("actions.edit") || "Edit"}
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("actions.delete") || "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title={t("data.materials.deleteConfirm.title") || "Delete Material"}
        description={
          t("data.materials.deleteConfirm.description") ||
          `Are you sure you want to delete "${material.name}"? This action cannot be undone.`
        }
        confirmText={t("actions.delete") || "Delete"}
        cancelText={t("actions.cancel") || "Cancel"}
      />
    </>
  );
}
