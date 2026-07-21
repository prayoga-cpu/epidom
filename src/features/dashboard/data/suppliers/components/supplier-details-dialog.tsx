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
  Store,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  FileText,
  Package,
} from "lucide-react";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import {
  formatDate,
  formatCurrency,
  formatNumber,
  getCurrencySymbol,
  formatDerivedUnitCost,
} from "@/lib/utils/formatting";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";

interface SupplierDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierWithRelations;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
}

export function SupplierDetailsDialog({
  open,
  onOpenChange,
  supplier,
  onEdit,
  onDelete,
}: SupplierDetailsDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { t } = useI18n();
  const { currency, convertPrice, formatPrice } = useCurrency();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl">{supplier.name}</DialogTitle>
              <DialogDescription>
                Supplier details, performance metrics, and order history
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("common.actions.edit")}
                </Button>
              )}
              {onDelete && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("common.actions.delete")}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Store className="h-5 w-5" />
              Contact Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                {supplier.contactPerson && (
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">
                      Contact Person
                    </label>
                    <p className="text-sm">{supplier.contactPerson}</p>
                  </div>
                )}
                {supplier.email && (
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">Email</label>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      <a href={`mailto:${supplier.email}`} className="hover:underline">
                        {supplier.email}
                      </a>
                    </div>
                  </div>
                )}
                {supplier.phone && (
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">Phone</label>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="text-muted-foreground h-4 w-4" />
                      <a href={`tel:${supplier.phone}`} className="hover:underline">
                        {supplier.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {(supplier.address || supplier.city || supplier.country) && (
                  <div>
                    <label className="text-muted-foreground text-sm font-medium">Address</label>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        {supplier.address && <p>{supplier.address}</p>}
                        {(supplier.city || supplier.country) && (
                          <p>{[supplier.city, supplier.country].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Supplied Materials */}
          {supplier.materialSuppliers && supplier.materialSuppliers.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Package className="h-5 w-5" />
                  Supplied Materials ({supplier.materialSuppliers.length})
                </h3>
                <div className="space-y-3">
                  {supplier.materialSuppliers.map((ms, index) => {
                    const material = ms.material;
                    const stockStatus =
                      Number(material.currentStock) <= Number(material.minStock)
                        ? "low"
                        : Number(material.currentStock) >= Number(material.maxStock)
                          ? "high"
                          : "normal";

                    return (
                      <div key={ms.id}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{material.name}</p>
                              {ms.isPreferred && (
                                <Badge variant="default" className="text-xs">
                                  Preferred
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {material.category && (
                                <Badge variant="secondary" className="mr-2 text-xs">
                                  {material.category}
                                </Badge>
                              )}
                              {material.sku && <span className="text-xs">SKU: {material.sku}</span>}
                            </p>
                            <div className="mt-1 flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">
                                Stock: {formatNumber(Number(material.currentStock))} {material.unit}
                              </span>
                              <span className="text-muted-foreground">
                                Unit Cost: {getCurrencySymbol(currency)}
                                {formatDerivedUnitCost(convertPrice(Number(material.unitCost)))}
                              </span>
                              <span className="font-medium text-green-600">
                                Supplier Price: {getCurrencySymbol(currency)}
                                {formatDerivedUnitCost(convertPrice(Number(ms.price)))}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={
                                stockStatus === "low"
                                  ? "destructive"
                                  : stockStatus === "high"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {stockStatus === "low"
                                ? t("common.stockStatus.lowStock")
                                : stockStatus === "high"
                                  ? t("common.stockStatus.overstocked")
                                  : t("common.stockStatus.inStock")}
                            </Badge>
                          </div>
                        </div>
                        {index < (supplier.materialSuppliers?.length ?? 0) - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="bg-muted/50 mt-4 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">
                    💡 This supplier provides these materials. You can manage supplier-specific
                    pricing and preferences in the materials section.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {supplier.notes && (
            <>
              <Separator />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5" />
                  Notes
                </h3>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="text-muted-foreground text-sm">{supplier.notes}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Created: {formatDate(supplier.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Updated: {formatDate(supplier.updatedAt)}</span>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      {onDelete && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t("data.suppliers.toasts.deleted.title")}
          description={
            t("data.suppliers.toasts.deleted.description")?.replace("{name}", supplier.name) || ""
          }
          confirmText={t("common.actions.delete")}
          onConfirm={async () => {
            if (onDelete) await onDelete();
          }}
          variant="destructive"
        />
      )}
    </Dialog>
  );
}
