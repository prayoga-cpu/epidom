"use client";

import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeProductionCard } from "../recipe-production/recipe-production";
import { ProductionHistoryCard } from "../production-history/production-history";
import { EditStockCard } from "../edit-stock/edit-stock";
import { SupplierDeliveriesTable } from "../delivery/supplier-deliveries-table";
import { SupplierDeliveryDetails } from "../delivery/supplier-delivery-details";
import { UpdateDeliveryStatusDialog } from "../delivery/update-delivery-status-dialog";
import { PrintDeliveryDialog } from "../delivery/print-delivery-dialog";
import { AddEditDeliveryDialog } from "../delivery/add-edit-delivery-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  useSupplierOrders,
  type SupplierOrder,
} from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import { useParams } from "next/navigation";
import { SupplierDelivery, SupplierDeliveryStatus, DeliveryType } from "@/types/entities";

// Adapter to convert SupplierOrder to SupplierDelivery format
function convertOrderToDelivery(order: SupplierOrder): SupplierDelivery {
  // Map statuses
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
        unitCost: 0, // Not available in SupplierOrderItem, use 0 as default
        currentStock: 0, // Not available in SupplierOrderItem, use 0 as default
        minStock: 0, // Not available in SupplierOrderItem, use 0 as default
        maxStock: 0, // Not available in SupplierOrderItem, use 0 as default

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

interface ManagementClientProps {
  initialSupplierOrders?: SupplierOrder[];
  storeId: string;
}

export function ManagementClient({ initialSupplierOrders, storeId }: ManagementClientProps) {
  const { t } = useI18n();
  const params = useParams();

  // Fetch supplier orders with initial data from Server Component
  const { data, isLoading } = useSupplierOrders(
    storeId,
    initialSupplierOrders
      ? {
          orders: initialSupplierOrders,
        }
      : undefined
  );

  // Filter for deliveries (PLACED orders waiting to be received) and convert to old format
  const deliveries = useMemo(() => {
    const orders = data?.orders || initialSupplierOrders || [];
    return orders
      .filter((order) => order.status === "PLACED" || order.status === "RECEIVED")
      .map(convertOrderToDelivery);
  }, [data, initialSupplierOrders]);

  const [selectedDelivery, setSelectedDelivery] = useState<SupplierDelivery | null>(null);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryToUpdate, setDeliveryToUpdate] = useState<SupplierDelivery | null>(null);
  const [deliveryToPrint, setDeliveryToPrint] = useState<SupplierDelivery | null>(null);
  const [deliveryToEdit, setDeliveryToEdit] = useState<SupplierDelivery | null>(null);

  // Set first delivery as selected when data loads
  useEffect(() => {
    if (deliveries.length > 0 && !selectedDelivery) {
      setSelectedDelivery(deliveries[0]);
    }
  }, [deliveries, selectedDelivery]);

  // Dialog handlers
  const handleUpdateStatus = (delivery: SupplierDelivery) => {
    setDeliveryToUpdate(delivery);
    setUpdateStatusDialogOpen(true);
  };

  const handlePrint = (delivery: SupplierDelivery) => {
    setDeliveryToPrint(delivery);
    setPrintDialogOpen(true);
  };

  const handleEdit = (delivery: SupplierDelivery) => {
    setDeliveryToEdit(delivery);
    setEditDialogOpen(true);
  };

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <Tabs defaultValue="deliveries" className="w-full">
        <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="deliveries"
          >
            {t("management.deliveries")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="production"
          >
            {t("management.production")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="history"
          >
            {t("management.history")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
            value="stock"
          >
            {t("management.stock")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries" className="space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("management.delivery.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("management.delivery.description")}</p>
          </div>

          <SupplierDeliveriesTable
            deliveries={deliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
            isLoading={isLoading}
            onUpdateStatus={handleUpdateStatus}
            onPrintDelivery={handlePrint}
            onEditDelivery={handleEdit}
          />
          {selectedDelivery && (
            <SupplierDeliveryDetails
              selectedDelivery={selectedDelivery}
              onUpdateStatus={handleUpdateStatus}
              onPrintDelivery={handlePrint}
              onEdit={handleEdit}
            />
          )}
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <RecipeProductionCard />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ProductionHistoryCard />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <EditStockCard />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {deliveryToUpdate && (
        <UpdateDeliveryStatusDialog
          open={updateStatusDialogOpen}
          onOpenChange={(open) => {
            setUpdateStatusDialogOpen(open);
            if (!open) {
              setDeliveryToUpdate(null);
            }
          }}
          delivery={deliveryToUpdate}
        />
      )}

      {deliveryToPrint && (
        <PrintDeliveryDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          delivery={deliveryToPrint}
        />
      )}

      {deliveryToEdit && (
        <AddEditDeliveryDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setDeliveryToEdit(null);
            }
          }}
          delivery={deliveryToEdit}
          mode="edit"
        />
      )}
    </div>
  );
}
