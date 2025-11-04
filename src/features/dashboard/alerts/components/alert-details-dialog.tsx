"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatDateTime } from "@/lib/utils/formatting";
import { AlertPriority, type Alert } from "@/types/entities";
import { MOCK_MATERIALS, MOCK_SUPPLIERS } from "@/mocks";
import {
  Package,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";

interface AlertDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: Alert | null;
  onCreateOrder?: () => void;
}

export function AlertDetailsDialog({
  open,
  onOpenChange,
  alert,
  onCreateOrder,
}: AlertDetailsDialogProps) {
  const { t } = useI18n();

  if (!alert) return null;

  const material = alert.materialId
    ? MOCK_MATERIALS.find((m) => m.id === alert.materialId)
    : null;
  const primarySupplier =
    material?.materialSuppliers?.find((s) => s.isPreferred) ||
    material?.materialSuppliers?.[0];
  const supplier = primarySupplier
    ? MOCK_SUPPLIERS.find((s) => s.id === primarySupplier.supplierId)
    : null;

  const currentStock = alert.metadata?.currentStock ?? material?.currentStock ?? 0;
  const minStock = alert.metadata?.minStock ?? material?.minStock ?? 0;
  const unit = alert.metadata?.unit ?? material?.unit ?? "";
  const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("alerts.detailsDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("alerts.detailsDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Info Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("alerts.table.currentStock")}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-red-600">
                      {currentStock}
                    </p>
                    <p className="text-xs text-muted-foreground">{unit}</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("alerts.detailsDialog.stockLevel")}
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stockPercentage.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("alerts.detailsDialog.ofMinimum")}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alert Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              {t("alerts.detailsDialog.alertInfo")}
            </h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">{t("alerts.detailsDialog.title")}</p>
                  <p className="text-sm text-muted-foreground">{alert.title}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1">{t("alerts.detailsDialog.message")}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("alerts.detailsDialog.created")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(alert.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("alerts.detailsDialog.alertId")}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">{alert.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Material Information */}
          {material && (
            <div>
              <h3 className="text-sm font-semibold mb-3">
                {t("alerts.detailsDialog.materialInfo")}
              </h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {t("alerts.table.material")}
                    </p>
                    <p className="text-sm text-muted-foreground">{material.name}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.detailsDialog.current")}
                      </p>
                      <p className="text-sm text-red-600 font-semibold">
                        {currentStock} {unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.detailsDialog.minimum")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {minStock} {unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.detailsDialog.needed")}
                      </p>
                      <p className="text-sm text-orange-600 font-semibold">
                        {minStock - currentStock} {unit}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Supplier Information */}
          {supplier && (
            <div>
              <h3 className="text-sm font-semibold mb-3">
                {t("alerts.detailsDialog.supplierInfo")}
              </h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.table.supplier")}
                      </p>
                      <p className="text-sm text-muted-foreground">{supplier.name}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.detailsDialog.phone")}
                      </p>
                      <a
                        href={`tel:${supplier.phone}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {supplier.phone}
                      </a>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {t("alerts.detailsDialog.email")}
                      </p>
                      <a
                        href={`mailto:${supplier.email}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {supplier.email}
                      </a>
                    </div>
                  </div>
                  {supplier.address && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium mb-1">
                            {t("alerts.detailsDialog.address")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {supplier.address}, {supplier.city}, {supplier.country}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.close")}
          </Button>
          {onCreateOrder && (
            <Button onClick={onCreateOrder}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t("alerts.actions.createOrder")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
