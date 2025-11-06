"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeProductionCard } from "../recipe-production/recipe-production";
import { ProductionHistoryCard } from "../production-history/production-history";
import { EditStockCard } from "../edit-stock/edit-stock";
import { SupplierDeliveriesTable } from "../delivery/supplier-deliveries-table";
import { SupplierDeliveryDetails } from "../delivery/supplier-delivery-details";
import UpdateDeliveryStatusDialog from "../delivery/update-delivery-status-dialog";
import PrintDeliveryDialog from "../delivery/print-delivery-dialog";
import AddEditDeliveryDialog from "../delivery/add-edit-delivery-dialog";
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
        isActive: true,
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

export function ManagementView() {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Fetch supplier orders
  const { data, isLoading } = useSupplierOrders(storeId);

  // Filter for deliveries (PLACED orders waiting to be received) and convert to old format
  const deliveries = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders
      .filter((order) => order.status === "PLACED" || order.status === "RECEIVED")
      .map(convertOrderToDelivery);
  }, [data]);

  const [selectedDelivery, setSelectedDelivery] = useState<SupplierDelivery | null>(null);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryToUpdate, setDeliveryToUpdate] = useState<SupplierDelivery | null>(null);
  const [deliveryToPrint, setDeliveryToPrint] = useState<SupplierDelivery | null>(null);
  const [deliveryToEdit, setDeliveryToEdit] = useState<SupplierDelivery | null>(null);

  // Set first delivery as selected when data loads
  useState(() => {
    if (deliveries.length > 0 && !selectedDelivery) {
      setSelectedDelivery(deliveries[0]);
    }
  });

  // Handler for updating status
  const handleUpdateStatus = (delivery: SupplierDelivery) => {
    setDeliveryToUpdate(delivery);
    setUpdateStatusDialogOpen(true);
  };

  // Handler for editing delivery
  const handleEditDelivery = (delivery: SupplierDelivery) => {
    setDeliveryToEdit(delivery);
    setEditDialogOpen(true);
  };

  // Handler for printing delivery
  const handlePrintDelivery = (delivery: SupplierDelivery) => {
    setDeliveryToPrint(delivery);
    setPrintDialogOpen(true);
  };

  // Handler for deleting delivery (placeholder for now)
  const handleDeleteDelivery = (deliveryId: string) => {
    // TODO: Implement delete confirmation
  };

  return (
    <section className="min-h-[calc(100vh-150px)]">
      <Tabs defaultValue="delivery" className="grid w-full gap-6">
        <TabsList className="bg-muted/50 -mx-4 w-full justify-start overflow-x-auto rounded-lg p-1.5 px-4 whitespace-nowrap shadow-sm backdrop-blur-sm sm:mx-0 sm:px-1.5">
          <TabsTrigger
            className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
            value="delivery"
          >
            {t("tabs.supplierDeliveries") || "Supplier Deliveries"}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
            value="recipe"
          >
            {t("tabs.recipeProduction") || "Recipe Production"}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
            value="history"
          >
            {t("tabs.productionHistory") || "Production History"}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
            value="stock"
          >
            {t("tabs.editStock") || "Edit Stock"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delivery" className="grid w-full gap-4 lg:grid-cols-3">
          <SupplierDeliveriesTable
            deliveries={deliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
            onEditDelivery={handleEditDelivery}
            onUpdateStatus={handleUpdateStatus}
            onPrintDelivery={handlePrintDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            isLoading={isLoading}
          />
          <SupplierDeliveryDetails
            selectedDelivery={selectedDelivery}
            onEdit={handleEditDelivery}
            onUpdateStatus={handleUpdateStatus}
            onPrintDelivery={handlePrintDelivery}
          />
        </TabsContent>

        <TabsContent value="recipe">
          <RecipeProductionCard />
        </TabsContent>

        <TabsContent value="history">
          <ProductionHistoryCard />
        </TabsContent>

        <TabsContent value="stock">
          <EditStockCard />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <UpdateDeliveryStatusDialog
        open={updateStatusDialogOpen}
        onOpenChange={setUpdateStatusDialogOpen}
        delivery={deliveryToUpdate}
      />
      <PrintDeliveryDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        delivery={deliveryToPrint}
      />
      <AddEditDeliveryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        delivery={deliveryToEdit}
        mode="edit"
      />
    </section>
  );
}
