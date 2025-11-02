"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/components/lang/i18n-provider";
import type { SupplierDelivery } from "@/types/entities";
import { DeliveryType, SupplierDeliveryStatus } from "@/types/entities";
import { formatDate, formatDateTime } from "@/lib/utils/formatting";
import {
  User,
  Phone,
  Mail,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Truck,
  FileText,
  Printer,
  TrendingUp,
  Building2,
} from "lucide-react";

interface SupplierDeliveryDetailsProps {
  selectedDelivery: SupplierDelivery | null;
  onEdit?: (delivery: SupplierDelivery) => void;
  onUpdateStatus?: (delivery: SupplierDelivery) => void;
  onPrintDelivery?: (delivery: SupplierDelivery) => void;
}

export function SupplierDeliveryDetails({
  selectedDelivery,
  onEdit,
  onUpdateStatus,
  onPrintDelivery,
}: SupplierDeliveryDetailsProps) {
  const { t } = useI18n();

  if (!selectedDelivery) {
    return (
      <Card className="shadow-md transition-shadow hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {t("pages.deliveryDetails") || "Delivery Details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground text-center text-sm">
            {t("messages.selectDelivery") || "Select a delivery to view details"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const delivery = selectedDelivery;

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

  // Get status styling
  const getStatusVariant = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return "secondary";
      case SupplierDeliveryStatus.IN_TRANSIT:
        return "default";
      case SupplierDeliveryStatus.RECEIVED:
        return "default";
      case SupplierDeliveryStatus.CANCELLED:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return Clock;
      case SupplierDeliveryStatus.IN_TRANSIT:
        return Truck;
      case SupplierDeliveryStatus.RECEIVED:
        return CheckCircle2;
      case SupplierDeliveryStatus.CANCELLED:
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const getTypeVariant = (type: DeliveryType) => {
    return type === DeliveryType.INCOMING ? "default" : "secondary";
  };

  const getTypeIcon = (type: DeliveryType) => {
    return type === DeliveryType.INCOMING ? Package : Truck;
  };

  // Get status label
  const getStatusLabel = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case SupplierDeliveryStatus.PENDING:
        return t("management.delivery.status.pending") || "Pending";
      case SupplierDeliveryStatus.IN_TRANSIT:
        return t("management.delivery.status.inTransit") || "In Transit";
      case SupplierDeliveryStatus.RECEIVED:
        return t("management.delivery.status.received") || "Received";
      case SupplierDeliveryStatus.CANCELLED:
        return t("management.delivery.status.cancelled") || "Cancelled";
      default:
        return status;
    }
  };

  // Get delivery type label
  const getTypeLabel = (type: DeliveryType) => {
    switch (type) {
      case DeliveryType.INCOMING:
        return t("management.delivery.type.incoming") || "Incoming";
      case DeliveryType.OUTGOING:
        return t("management.delivery.type.outgoing") || "Outgoing";
      default:
        return type;
    }
  };

  const StatusIcon = getStatusIcon(delivery.status);
  const TypeIcon = getTypeIcon(delivery.deliveryType);

  return (
    <Card className="shadow-md transition-shadow hover:shadow-lg">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{delivery.deliveryReference}</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">{t("management.delivery.details.deliveryId") || "Delivery ID"}: {delivery.id}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Badge variant={getStatusVariant(delivery.status)} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {getStatusLabel(delivery.status)}
            </Badge>
            <Badge variant={getTypeVariant(delivery.deliveryType)} className="gap-1">
              <TypeIcon className="h-3 w-3" />
              {getTypeLabel(delivery.deliveryType)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {/* Supplier Information */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" />
            {t("management.delivery.details.supplier") || "Supplier"}
          </h3>
          <div className="bg-muted/30 space-y-1.5 rounded-lg p-3 text-sm">
            <p className="font-medium">{delivery.supplier?.name}</p>
            {delivery.supplier?.contactPerson && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <User className="h-3 w-3" />
                {delivery.supplier.contactPerson}
              </div>
            )}
            {delivery.supplier?.email && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Mail className="h-3 w-3" />
                {delivery.supplier.email}
              </div>
            )}
            {delivery.supplier?.phone && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Phone className="h-3 w-3" />
                {delivery.supplier.phone}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Information */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4" />
            {t("management.delivery.details.deliveryDetails") || "Delivery Details"}
          </h3>
          <div className="bg-muted/30 space-y-1.5 rounded-lg p-3 text-sm">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">{t("management.delivery.details.expected") || "Expected"}:</span> {formatDateTime(delivery.expectedDate)}
            </div>
            {delivery.receivedDate && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-medium">{t("management.delivery.details.received") || "Received"}:</span>{" "}
                {formatDateTime(delivery.receivedDate)}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Delivery Items */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4" />
            {t("management.delivery.details.items") || "Items"} ({delivery.items.length})
          </h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("management.delivery.details.material") || "Material"}</TableHead>
                  <TableHead className="text-right text-xs">{t("management.delivery.details.quantity") || "Quantity"}</TableHead>
                  <TableHead className="text-xs">{t("management.delivery.details.unit") || "Unit"}</TableHead>
                  <TableHead className="text-xs">{t("management.delivery.details.notes") || "Notes"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delivery.items.map((item, index) => {
                  return (
                    <TableRow key={index}>
                      <TableCell className="text-xs">
                        <div>
                          <div className="font-medium">{item.material?.name || t("management.delivery.details.unknownMaterial")}</div>
                          {item.material?.sku && (
                            <div className="text-muted-foreground text-xs">{t("common.sku")}: {item.material.sku}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-xs">{item.unit}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.notes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Delivery Timeline */}
        {delivery.statusHistory && delivery.statusHistory.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" />
              {t("management.delivery.details.timeline") || "Timeline"}
            </h3>
            <div className="space-y-2">
              {delivery.statusHistory?.map((history, index) => {
                const HistoryIcon = getStatusIcon(history.status);
                const historyLength = delivery.statusHistory?.length || 0;
                return (
                  <div key={history.id} className="flex gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          index === historyLength - 1 ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <HistoryIcon className="text-primary-foreground h-3 w-3" />
                      </div>
                      {index < historyLength - 1 && <div className="bg-muted h-full w-0.5"></div>}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{getStatusLabel(history.status)}</p>
                          <p className="text-muted-foreground text-xs">{translateSystemNote(history.notes)}</p>
                          {history.userName && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {t("management.delivery.details.by") || "by"} {history.userName}
                            </p>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(history.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {delivery.notes && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" />
              {t("management.delivery.details.notes") || "Notes"}
            </h3>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground text-xs">{translateSystemNote(delivery.notes)}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Quick Actions */}
        <div className="flex flex-col gap-2">
          {onUpdateStatus &&
            delivery.status !== SupplierDeliveryStatus.RECEIVED &&
            delivery.status !== SupplierDeliveryStatus.CANCELLED && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(delivery)}
                className="w-full justify-start gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                {t("management.delivery.details.updateStatus") || "Update Status"}
              </Button>
            )}
          {onEdit &&
            delivery.status !== SupplierDeliveryStatus.RECEIVED &&
            delivery.status !== SupplierDeliveryStatus.CANCELLED && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(delivery)}
                className="w-full justify-start gap-2"
              >
                <Edit className="h-4 w-4" />
                {t("management.delivery.details.editDelivery") || "Edit Delivery"}
              </Button>
            )}
          {onPrintDelivery && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPrintDelivery(delivery)}
              className="w-full justify-start gap-2"
            >
              <Printer className="h-4 w-4" />
              {t("management.delivery.details.printDelivery") || "Print Delivery"}
            </Button>
          )}
        </div>

        {/* Metadata */}
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>{t("management.delivery.details.created") || "Created"}: {formatDateTime(delivery.createdAt)}</p>
          <p>{t("management.delivery.details.updated") || "Updated"}: {formatDateTime(delivery.updatedAt)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
