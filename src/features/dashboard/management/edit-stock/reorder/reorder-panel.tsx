"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, History, Plus, Truck } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useSupplierOrders,
  type SupplierOrder,
} from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useAlerts, type LowStockAlert } from "@/features/dashboard/shared/hooks/use-alerts";
import { SupplierDelivery, SupplierDeliveryStatus, DeliveryType } from "@/types/entities";
import { OpenOrdersList } from "./open-orders-list";
import { SupplierDeliveriesTable } from "./supplier-deliveries-table";
import { SupplierDeliveryDetails } from "./supplier-delivery-details";
import { AddEditDeliveryDialog } from "./add-edit-delivery-dialog";
import { PlaceOrderDialog } from "./place-order-dialog";
import { BulkOrderDialog } from "./bulk-order-dialog";
import { SendToSupplierDialog } from "./send-to-supplier-dialog";

// Adapter to convert SupplierOrder to SupplierDelivery format
function convertOrderToDelivery(order: SupplierOrder): SupplierDelivery {
  const statusMap: Record<typeof order.status, SupplierDeliveryStatus> = {
    PENDING: SupplierDeliveryStatus.PENDING,
    PLACED: SupplierDeliveryStatus.IN_TRANSIT,
    RECEIVED: SupplierDeliveryStatus.RECEIVED,
    CANCELLED: SupplierDeliveryStatus.CANCELLED,
  };

  return {
    id: order.id,
    deliveryReference: order.orderNumber,
    supplierId: order.supplier.id,
    supplier: {
      id: order.supplier.id,
      name: order.supplier.name,
      email: order.supplier.email || undefined,
      phone: order.supplier.phone || undefined,
      storeId: order.storeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    deliveryType: DeliveryType.INCOMING,
    status: statusMap[order.status],
    expectedDate: new Date(order.expectedDate || order.orderDate),
    receivedDate: order.receivedDate ? new Date(order.receivedDate) : undefined,
    notes: order.notes ?? undefined,
    storeId: order.storeId,
    items: order.items.map((item) => ({
      id: item.id,
      deliveryId: order.id,
      materialId: item.materialId,
      material: {
        id: item.material.id,
        name: item.material.name,
        sku: item.material.sku,
        unit: item.material.unit,
        unitCost: 0,
        currentStock: 0,
        minStock: 0,
        maxStock: 0,
        storeId: order.storeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      quantity: Number(item.quantity),
      unit: item.unit,
    })),
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt || order.createdAt),
  };
}

interface ReorderPanelProps {
  storeId: string;
  initialSupplierOrders?: SupplierOrder[];
  /** A materialId deep-linked from Alerts (?highlight=) — opens the place-order
   * dialog pre-filled for that material once, then the caller clears the param. */
  highlightMaterialId?: string | null;
  /** A supplier id deep-linked from Alerts' "Bulk Order" action (?supplierId=)
   * — opens the bulk-order dialog for that supplier's low-stock items once. */
  highlightSupplierId?: string | null;
  onHighlightConsumed?: () => void;
}

export function ReorderPanel({
  storeId,
  initialSupplierOrders,
  highlightMaterialId,
  highlightSupplierId,
  onHighlightConsumed,
}: ReorderPanelProps) {
  const { t } = useI18n();

  const { data } = useSupplierOrders(
    storeId,
    initialSupplierOrders ? { orders: initialSupplierOrders } : undefined
  );

  // Finished orders only: open ones (PLACED, legacy PENDING) live in the
  // "Awaiting delivery" list above, each with its own Received button.
  const history = useMemo(() => {
    const orders = data?.orders || initialSupplierOrders || [];
    return orders
      .filter((order) => order.status === "RECEIVED" || order.status === "CANCELLED")
      .map(convertOrderToDelivery);
  }, [data, initialSupplierOrders]);

  // Collapsed by default: the page's job is the open orders, and history is
  // for looking something up.
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<SupplierDelivery | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryToEdit, setDeliveryToEdit] = useState<SupplierDelivery | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deliveryToSend, setDeliveryToSend] = useState<string | null>(null);

  const handleEdit = (order: SupplierOrder) => {
    setDeliveryToEdit(convertOrderToDelivery(order));
    setEditDialogOpen(true);
  };

  // "Print/Download" opens the dedicated print page (window.print → Save as
  // PDF), matching the codebase's established print-page convention rather
  // than the older jsPDF-dialog-download pattern this replaces.
  const handlePrint = (orderId: string) => {
    window.open(`/store/${storeId}/management/print?orderId=${orderId}`, "_blank");
  };

  const handleSend = (orderId: string) => {
    setDeliveryToSend(orderId);
    setSendDialogOpen(true);
  };

  // Manual "New Order" entry point (no pre-selected material).
  const [manualOrderOpen, setManualOrderOpen] = useState(false);

  // "Send to supplier" on a create dialog's success screen: swap that dialog
  // for the send dialog rather than stacking one on top of the other.
  const sendFromCreateDialog = (close: () => void) => (orderId: string) => {
    close();
    handleSend(orderId);
  };

  // Deep-linked from Alerts: open the place-order dialog for a specific
  // material once, using its live LowStockAlert (supplier suggestions,
  // suggested quantity), then let the caller strip the URL param.
  const { data: alertsData } = useAlerts(storeId);
  const lowStockAlerts = alertsData?.alerts.filter(
    (a): a is LowStockAlert => a.type === "LOW_STOCK"
  );

  const [highlightOrderOpen, setHighlightOrderOpen] = useState(false);
  const consumedMaterialRef = useRef<string | null>(null);

  const highlightAlert = useMemo(() => {
    if (!highlightMaterialId || !lowStockAlerts) return null;
    return lowStockAlerts.find((a) => a.materialId === highlightMaterialId) ?? null;
  }, [lowStockAlerts, highlightMaterialId]);

  useEffect(() => {
    if (!highlightMaterialId || consumedMaterialRef.current === highlightMaterialId) return;
    // Wait for alerts to resolve (either found, or confirmed absent) before
    // opening — lowStockAlerts starts undefined while loading.
    if (lowStockAlerts === undefined) return;
    consumedMaterialRef.current = highlightMaterialId;
    setHighlightOrderOpen(true);
  }, [highlightMaterialId, lowStockAlerts]);

  const handleHighlightDialogChange = (open: boolean) => {
    setHighlightOrderOpen(open);
    if (!open) onHighlightConsumed?.();
  };

  // Deep-linked from Alerts' "Bulk Order" action: open the bulk-order dialog
  // pre-filled with every low-stock item from that supplier, once.
  const [highlightBulkOpen, setHighlightBulkOpen] = useState(false);
  const consumedSupplierRef = useRef<string | null>(null);

  const highlightSupplierGroup = useMemo(() => {
    if (!highlightSupplierId || !lowStockAlerts) return null;
    const items = lowStockAlerts.filter((a) => a.suppliers.some((s) => s.id === highlightSupplierId));
    if (items.length === 0) return null;
    const supplierName =
      items[0].suppliers.find((s) => s.id === highlightSupplierId)?.name ?? "";
    return { items, supplierName };
  }, [lowStockAlerts, highlightSupplierId]);

  useEffect(() => {
    if (!highlightSupplierId || consumedSupplierRef.current === highlightSupplierId) return;
    if (lowStockAlerts === undefined) return;
    consumedSupplierRef.current = highlightSupplierId;
    setHighlightBulkOpen(true);
  }, [highlightSupplierId, lowStockAlerts]);

  const handleHighlightBulkDialogChange = (open: boolean) => {
    setHighlightBulkOpen(open);
    if (!open) onHighlightConsumed?.();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            {t("management.delivery.openOrders.title")}
          </CardTitle>
          <Button size="sm" onClick={() => setManualOrderOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("alerts.actions.createOrder")}
          </Button>
        </CardHeader>
        <CardContent>
          <OpenOrdersList
            storeId={storeId}
            onSend={handleSend}
            onPrint={handlePrint}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <section className="space-y-4">
          <Button
            variant="outline"
            className="h-11 w-full justify-between"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("management.delivery.history.title")} ({history.length})
            </span>
            <span className="text-muted-foreground flex items-center gap-1 text-sm font-normal">
              {showHistory
                ? t("management.delivery.history.hide")
                : t("management.delivery.history.show")}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showHistory && "rotate-180")}
              />
            </span>
          </Button>

          {showHistory && (
            <>
              <SupplierDeliveriesTable
                hideHeader
                deliveries={history}
                selectedDelivery={selectedDelivery}
                // A second click on the open row closes its details again.
                onDeliverySelect={(delivery) =>
                  setSelectedDelivery((current) => (current?.id === delivery.id ? null : delivery))
                }
                isLoading={false}
                onPrintDelivery={(delivery) => handlePrint(delivery.id)}
              />
              {selectedDelivery && (
                <SupplierDeliveryDetails
                  selectedDelivery={selectedDelivery}
                  onPrintDelivery={(delivery) => handlePrint(delivery.id)}
                />
              )}
            </>
          )}
        </section>
      )}

      {deliveryToEdit && (
        <AddEditDeliveryDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setDeliveryToEdit(null);
          }}
          delivery={deliveryToEdit}
        />
      )}

      <SendToSupplierDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          if (!open) setDeliveryToSend(null);
        }}
        orderId={deliveryToSend}
      />

      <PlaceOrderDialog
        open={manualOrderOpen}
        onOpenChange={setManualOrderOpen}
        onSend={sendFromCreateDialog(() => setManualOrderOpen(false))}
      />

      <PlaceOrderDialog
        open={highlightOrderOpen}
        onOpenChange={handleHighlightDialogChange}
        alert={highlightAlert}
        onSend={sendFromCreateDialog(() => handleHighlightDialogChange(false))}
      />

      {highlightSupplierGroup && (
        <BulkOrderDialog
          open={highlightBulkOpen}
          onOpenChange={handleHighlightBulkDialogChange}
          alerts={highlightSupplierGroup.items}
          supplierName={highlightSupplierGroup.supplierName}
          supplierId={highlightSupplierId!}
        />
      )}
    </div>
  );
}
