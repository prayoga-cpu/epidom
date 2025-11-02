"use client";

import { useState } from "react";
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
import { MOCK_SUPPLIER_DELIVERIES } from "@/mocks";
import type { SupplierDelivery } from "@/types/entities";

export function ManagementView() {
  const [selectedDelivery, setSelectedDelivery] = useState<SupplierDelivery | null>(
    MOCK_SUPPLIER_DELIVERIES[0] || null
  );
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryToUpdate, setDeliveryToUpdate] = useState<SupplierDelivery | null>(null);
  const [deliveryToPrint, setDeliveryToPrint] = useState<SupplierDelivery | null>(null);
  const [deliveryToEdit, setDeliveryToEdit] = useState<SupplierDelivery | null>(null);
  const { t } = useI18n();

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
            deliveries={MOCK_SUPPLIER_DELIVERIES}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
            onEditDelivery={handleEditDelivery}
            onUpdateStatus={handleUpdateStatus}
            onPrintDelivery={handlePrintDelivery}
            onDeleteDelivery={handleDeleteDelivery}
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
