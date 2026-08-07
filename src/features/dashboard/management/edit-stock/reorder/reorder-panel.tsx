"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ShoppingCart, Truck, Send } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useSupplierOrders,
  type SupplierOrder,
} from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useAlerts, type LowStockAlert } from "@/features/dashboard/shared/hooks/use-alerts";
import { SupplierDelivery, SupplierDeliveryStatus, DeliveryType } from "@/types/entities";
import { OrdersToPlaceView } from "./orders-to-place-view";
import { SupplierDeliveriesTable } from "./supplier-deliveries-table";
import { SupplierDeliveryDetails } from "./supplier-delivery-details";
import { UpdateDeliveryStatusDialog } from "./update-delivery-status-dialog";
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

  const deliveries = useMemo(() => {
    const orders = data?.orders || initialSupplierOrders || [];
    return orders
      .filter((order) => order.status === "PLACED" || order.status === "RECEIVED")
      .map(convertOrderToDelivery);
  }, [data, initialSupplierOrders]);

  const [selectedDelivery, setSelectedDelivery] = useState<SupplierDelivery | null>(null);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryToUpdate, setDeliveryToUpdate] = useState<SupplierDelivery | null>(null);
  const [deliveryToEdit, setDeliveryToEdit] = useState<SupplierDelivery | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deliveryToSend, setDeliveryToSend] = useState<string | null>(null);

  useEffect(() => {
    if (deliveries.length > 0 && !selectedDelivery) {
      setSelectedDelivery(deliveries[0]);
    }
  }, [deliveries, selectedDelivery]);

  const handleUpdateStatus = (delivery: SupplierDelivery) => {
    setDeliveryToUpdate(delivery);
    setUpdateStatusDialogOpen(true);
  };

  const handleEdit = (delivery: SupplierDelivery) => {
    setDeliveryToEdit(delivery);
    setEditDialogOpen(true);
  };

  // "Print/Download" opens the dedicated print page (window.print → Save as
  // PDF), matching the codebase's established print-page convention rather
  // than the older jsPDF-dialog-download pattern this replaces.
  const handlePrint = (delivery: SupplierDelivery) => {
    window.open(`/store/${storeId}/management/print?orderId=${delivery.id}`, "_blank");
  };

  const handleSend = (delivery: SupplierDelivery) => {
    setDeliveryToSend(delivery.id);
    setSendDialogOpen(true);
  };

  // Manual "New Order" entry point (no pre-selected material).
  const [manualOrderOpen, setManualOrderOpen] = useState(false);

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
            <ShoppingCart className="h-4 w-4" />
            {t("alerts.ordersToPlace")}
          </CardTitle>
          <Button size="sm" onClick={() => setManualOrderOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("alerts.actions.createOrder")}
          </Button>
        </CardHeader>
        <CardContent>
          <OrdersToPlaceView />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            {t("management.delivery.title")}
          </CardTitle>
          {selectedDelivery && (
            <Button size="sm" variant="outline" onClick={() => handleSend(selectedDelivery)}>
              <Send className="mr-1 h-4 w-4" />
              {t("management.delivery.sendToSupplier")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <SupplierDeliveriesTable
            deliveries={deliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
            isLoading={false}
            onUpdateStatus={handleUpdateStatus}
            onEditDelivery={handleEdit}
            onPrintDelivery={handlePrint}
          />
          {selectedDelivery && (
            <SupplierDeliveryDetails
              selectedDelivery={selectedDelivery}
              onUpdateStatus={handleUpdateStatus}
              onEdit={handleEdit}
              onPrintDelivery={handlePrint}
            />
          )}
        </CardContent>
      </Card>

      {deliveryToUpdate && (
        <UpdateDeliveryStatusDialog
          open={updateStatusDialogOpen}
          onOpenChange={(open) => {
            setUpdateStatusDialogOpen(open);
            if (!open) setDeliveryToUpdate(null);
          }}
          delivery={deliveryToUpdate}
        />
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

      <PlaceOrderDialog open={manualOrderOpen} onOpenChange={setManualOrderOpen} />

      <PlaceOrderDialog
        open={highlightOrderOpen}
        onOpenChange={handleHighlightDialogChange}
        alert={highlightAlert}
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
