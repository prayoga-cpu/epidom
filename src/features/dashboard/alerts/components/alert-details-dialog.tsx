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

  // Alert metadata should contain all necessary information
  const material = alert.material;
  const primarySupplier =
    material?.materialSuppliers?.find((s) => s.isPreferred) || material?.materialSuppliers?.[0];
  const supplier = primarySupplier?.supplier;

  const currentStock = alert.metadata?.currentStock ?? material?.currentStock ?? 0;
  const minStock = alert.metadata?.minStock ?? material?.minStock ?? 0;
  const unit = alert.metadata?.unit ?? material?.unit ?? "";
  const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("alerts.detailsDialog.title")}</DialogTitle>
          <DialogDescription>{t("alerts.detailsDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Info Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("alerts.table.currentStock")}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-red-600">{currentStock}</p>
                    <p className="text-muted-foreground text-xs">{unit}</p>
                  </div>
                  <Package className="text-muted-foreground h-8 w-8" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("alerts.detailsDialog.stockLevel")}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{stockPercentage.toFixed(0)}%</p>
                    <p className="text-muted-foreground text-xs">
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
            <h3 className="mb-3 text-sm font-semibold">{t("alerts.detailsDialog.alertInfo")}</h3>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.title")}</p>
                  <p className="text-muted-foreground text-sm">{alert.title}</p>
                </div>
                <Separator />
                <div>
                  <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.message")}</p>
                  <p className="text-muted-foreground text-sm">{alert.message}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.created")}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatDateTime(alert.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.alertId")}</p>
                    <p className="text-muted-foreground font-mono text-sm">{alert.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Material Information */}
          {material && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                {t("alerts.detailsDialog.materialInfo")}
              </h3>
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("alerts.table.material")}</p>
                    <p className="text-muted-foreground text-sm">{material.name}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        {t("alerts.detailsDialog.current")}
                      </p>
                      <p className="text-sm font-semibold text-red-600">
                        {currentStock} {unit}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        {t("alerts.detailsDialog.minimum")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {minStock} {unit}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.needed")}</p>
                      <p className="text-sm font-semibold text-orange-600">
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
              <h3 className="mb-3 text-sm font-semibold">
                {t("alerts.detailsDialog.supplierInfo")}
              </h3>
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start gap-3">
                    <User className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="mb-1 text-sm font-medium">{t("alerts.table.supplier")}</p>
                      <p className="text-muted-foreground text-sm">{supplier.name}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Phone className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.phone")}</p>
                      <a
                        /**
                         * Type assertion needed because supplier type may not include phone property
                         * Actual type: string | undefined
                         * TODO: Update supplier type to include all contact fields
                         */
                        href={`tel:${(supplier as any)?.phone || ""}`}
                        className="text-primary text-sm hover:underline"
                      >
                        {(supplier as any)?.phone || t("alerts.detailsDialog.notAvailable")}
                      </a>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Mail className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="mb-1 text-sm font-medium">{t("alerts.detailsDialog.email")}</p>
                      <a
                        /**
                         * Type assertion needed because supplier type may not include email property
                         * Actual type: string | undefined
                         * TODO: Update supplier type to include all contact fields
                         */
                        href={`mailto:${(supplier as any)?.email || ""}`}
                        className="text-primary text-sm hover:underline"
                      >
                        {(supplier as any)?.email || t("alerts.detailsDialog.notAvailable")}
                      </a>
                    </div>
                  </div>
                  {/**
                   * Type assertion needed because supplier type may not include address properties
                   * Actual type: string | undefined
                   * TODO: Update supplier type to include all address fields
                   */}
                  {(supplier as any)?.address && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <MapPin className="text-muted-foreground mt-0.5 h-5 w-5" />
                        <div>
                          <p className="mb-1 text-sm font-medium">
                            {t("alerts.detailsDialog.address")}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {(supplier as any)?.address}, {(supplier as any)?.city},{" "}
                            {(supplier as any)?.country}
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
              <ShoppingCart className="mr-1 h-4 w-4 hidden sm:inline" />
              {t("alerts.actions.createOrder")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
