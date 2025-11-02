"use client";

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { SupplierDelivery } from "@/types/entities";
import { formatDate } from "@/lib/utils/formatting";
import { Printer, Download } from "lucide-react";

interface PrintDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: SupplierDelivery | null;
}

export default function PrintDeliveryDialog({
  open,
  onOpenChange,
  delivery,
}: PrintDeliveryDialogProps) {
  const { t } = useI18n();
  const printRef = useRef<HTMLDivElement>(null);

  // Helper function to translate system notes
  const translateSystemNote = (note: string | null | undefined): string => {
    if (!note) return "";

    // Map of English system notes to translation keys
    const systemNoteMap: Record<string, string> = {
      "Delivery scheduled": "management.delivery.details.systemNotes.deliveryScheduled",
      "Shipment departed from supplier warehouse": "management.delivery.details.systemNotes.shipmentDeparted",
      "All items received in good condition": "management.delivery.details.systemNotes.itemsReceived",
      "Out for delivery": "management.delivery.details.systemNotes.outForDelivery",
      "Order placed, awaiting confirmation": "management.delivery.details.systemNotes.orderPlaced",
      "Weekly bulk order scheduled": "management.delivery.details.systemNotes.weeklyBulkOrder",
      "Special order for specialty items": "management.delivery.details.systemNotes.specialOrder",
      "Regular dairy delivery": "management.delivery.details.systemNotes.regularDairyDelivery",
      "Regular weekly delivery - all items inspected and stored properly": "management.delivery.details.systemNotes.regularWeeklyDelivery",
    };

    // Check if note matches a system message
    const translationKey = systemNoteMap[note];
    if (translationKey) {
      return t(translationKey) || note;
    }

    // If not a system message, return as-is (could be user input)
    return note;
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const printTitle = t("management.delivery.dialogs.printDelivery.title") || "Print Delivery";
        printWindow.document.write(`
          <html>
            <head>
              <title>${printTitle} ${delivery?.deliveryReference}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 20px;
                  color: #333;
                }
                h1 {
                  font-size: 24px;
                  margin-bottom: 10px;
                }
                h2 {
                  font-size: 18px;
                  margin-top: 20px;
                  margin-bottom: 10px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 10px;
                }
                th, td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: left;
                }
                th {
                  background-color: #f4f4f4;
                  font-weight: bold;
                }
                .header-section {
                  margin-bottom: 20px;
                  padding: 10px;
                  background-color: #f9f9f9;
                  border-radius: 4px;
                }
                .info-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 5px;
                }
                .label {
                  font-weight: bold;
                  margin-right: 10px;
                }
                @media print {
                  button {
                    display: none;
                  }
                }
              </style>
            </head>
            <body>
              ${printRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
    alert(t("management.delivery.dialogs.printDelivery.pdfNotImplemented") || "PDF export functionality will be implemented with a PDF library");
  };

  // Helper functions for translations
  const getStatusLabel = (status: string) => {
    return t(`management.delivery.status.${status.toLowerCase()}`) || status;
  };

  const getTypeLabel = (type: string) => {
    return t(`management.delivery.type.${type.toLowerCase()}`) || type;
  };

  if (!delivery) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("management.delivery.dialogs.printDelivery.title")}</DialogTitle>
          <DialogDescription>
            {(t("management.delivery.dialogs.printDelivery.previewDescription") || "Preview and print delivery {reference}").replace("{reference}", delivery.deliveryReference)}
          </DialogDescription>
        </DialogHeader>

        {/* Print Content */}
        <div ref={printRef} className="space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">{t("management.delivery.dialogs.printDelivery.supplierDeliveryNote")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("management.delivery.table.reference")}: {delivery.deliveryReference}
            </p>
          </div>

          {/* Delivery Information */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("management.delivery.details.deliveryDetails")}</h2>
              <div className="flex gap-2">
                <Badge variant="secondary">{getTypeLabel(delivery.deliveryType)}</Badge>
                <Badge>{getStatusLabel(delivery.status)}</Badge>
              </div>
            </div>
            <Separator className="my-2" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{t("management.delivery.table.expectedDate")}:</span>
                <span>{formatDate(delivery.expectedDate)}</span>
              </div>
              {delivery.receivedDate && (
                <div className="flex justify-between">
                  <span className="font-medium">{t("management.delivery.details.received")}:</span>
                  <span>{formatDate(delivery.receivedDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Information */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h2 className="mb-2 text-lg font-semibold">{t("management.delivery.details.supplier")}</h2>
            <Separator className="my-2" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{t("common.name")}:</span>
                <span>{delivery.supplier?.name}</span>
              </div>
              {delivery.supplier?.contactPerson && (
                <div className="flex justify-between">
                  <span className="font-medium">{t("management.delivery.dialogs.printDelivery.contactPerson")}:</span>
                  <span>{delivery.supplier.contactPerson}</span>
                </div>
              )}
              {delivery.supplier?.phone && (
                <div className="flex justify-between">
                  <span className="font-medium">{t("common.phone")}:</span>
                  <span>{delivery.supplier.phone}</span>
                </div>
              )}
              {delivery.supplier?.email && (
                <div className="flex justify-between">
                  <span className="font-medium">{t("common.email")}:</span>
                  <span>{delivery.supplier.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h2 className="mb-2 text-lg font-semibold">{t("management.delivery.details.items")}</h2>
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">#</th>
                  <th className="border p-2 text-left">{t("management.delivery.details.material")}</th>
                  <th className="border p-2 text-left">{t("common.sku")}</th>
                  <th className="border p-2 text-right">{t("management.delivery.details.quantity")}</th>
                  <th className="border p-2 text-left">{t("management.delivery.details.unit")}</th>
                  <th className="border p-2 text-left">{t("management.delivery.details.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {delivery.items.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2">{item.material?.name || t("management.delivery.details.unknownMaterial")}</td>
                    <td className="border p-2">{item.material?.sku || "-"}</td>
                    <td className="border p-2 text-right">{item.quantity}</td>
                    <td className="border p-2">{item.unit}</td>
                    <td className="border p-2">{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {delivery.notes && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h2 className="mb-2 text-lg font-semibold">{t("management.delivery.details.notes")}</h2>
              <Separator className="my-2" />
              <p className="text-sm">{translateSystemNote(delivery.notes)}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-muted-foreground mt-6 text-xs">
            <p>{t("management.delivery.dialogs.printDelivery.printedOn")}: {formatDate(new Date())}</p>
            <p>{t("management.delivery.dialogs.printDelivery.generatedBy")}</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.close")}
          </Button>
          <Button type="button" variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            {t("management.delivery.dialogs.printDelivery.downloadPDF")}
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t("management.delivery.dialogs.printDelivery.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
