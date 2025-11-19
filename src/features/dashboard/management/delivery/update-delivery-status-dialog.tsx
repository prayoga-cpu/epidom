"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import { SupplierDelivery, SupplierDeliveryStatus } from "@/types/entities";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/utils/formatting";
import { CalendarIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { toast as sonnerToast } from "sonner";
import { useUpdateSupplierOrder } from "@/features/dashboard/tracking/hooks/use-supplier-orders";

interface UpdateDeliveryStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: SupplierDelivery | null;
}

export default function UpdateDeliveryStatusDialog({
  open,
  onOpenChange,
  delivery,
}: UpdateDeliveryStatusDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;
  const [newStatus, setNewStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined);

  // Use mutation hook for updating
  const updateMutation = useUpdateSupplierOrder(storeId, delivery?.id || "");

  useEffect(() => {
    if (delivery) {
      setNewStatus("");
      setNotes("");
      setReceivedDate(undefined);
    }
  }, [delivery]);

  const getAvailableStatuses = () => {
    if (!delivery) return [];

    const currentStatus = delivery.status;
    const statuses = [];

    // Define valid status transitions
    if (currentStatus === SupplierDeliveryStatus.PENDING) {
      statuses.push(
        {
          value: SupplierDeliveryStatus.IN_TRANSIT,
          label: t("management.delivery.status.inTransit") || "In Transit",
        },
        {
          value: SupplierDeliveryStatus.RECEIVED,
          label: t("management.delivery.status.received") || "Received",
        },
        {
          value: SupplierDeliveryStatus.CANCELLED,
          label: t("management.delivery.status.cancelled") || "Cancelled",
        }
      );
    } else if (currentStatus === SupplierDeliveryStatus.IN_TRANSIT) {
      statuses.push(
        {
          value: SupplierDeliveryStatus.RECEIVED,
          label: t("management.delivery.status.received") || "Received",
        },
        {
          value: SupplierDeliveryStatus.CANCELLED,
          label: t("management.delivery.status.cancelled") || "Cancelled",
        }
      );
    }

    return statuses;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStatus) {
      toast({
        title: t("common.validation.error") || "Error",
        description:
          t("management.delivery.updateStatus.selectNewStatus") || "Please select a new status",
        variant: "destructive",
      });
      return;
    }

    if (newStatus === SupplierDeliveryStatus.RECEIVED && !receivedDate) {
      toast({
        title: t("common.validation.error") || "Error",
        description:
          t("management.delivery.updateStatus.selectReceivedDate") ||
          "Please select a received date",
        variant: "destructive",
      });
      return;
    }

    if (!delivery) return;

    // Map UI status to database status
    const statusMap: Record<string, "PENDING" | "PLACED" | "RECEIVED" | "CANCELLED"> = {
      [SupplierDeliveryStatus.PENDING]: "PENDING",
      [SupplierDeliveryStatus.IN_TRANSIT]: "PLACED",
      [SupplierDeliveryStatus.RECEIVED]: "RECEIVED",
      [SupplierDeliveryStatus.CANCELLED]: "CANCELLED",
    };

    const dbStatus = statusMap[newStatus];

    const payload: {
      status: "PENDING" | "PLACED" | "RECEIVED" | "CANCELLED";
      notes?: string;
      receivedDate?: string;
    } = {
      status: dbStatus,
    };

    if (notes) {
      payload.notes = notes;
    }

    if (newStatus === SupplierDeliveryStatus.RECEIVED && receivedDate) {
      payload.receivedDate = receivedDate.toISOString();
    }

    // Use mutation hook to update
    updateMutation.mutate(
      payload as {
        status: "PENDING" | "PLACED" | "RECEIVED" | "CANCELLED";
        notes?: string;
        receivedDate?: string;
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const availableStatuses = getAvailableStatuses();

  // Helper to get the translation key for a status
  const getStatusTranslationKey = (status: string) => {
    const statusMap: Record<string, string> = {
      [SupplierDeliveryStatus.PENDING]: "pending",
      [SupplierDeliveryStatus.IN_TRANSIT]: "inTransit",
      [SupplierDeliveryStatus.RECEIVED]: "received",
      [SupplierDeliveryStatus.CANCELLED]: "cancelled",
    };
    return statusMap[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("management.delivery.updateStatus.title") || "Update Delivery Status"}
        description={(
          t("management.delivery.updateStatus.description") ||
          "Update delivery status for {reference}"
        ).replace("{reference}", delivery?.deliveryReference || "")}
        maxWidth="md"
        footer={
          <FormDialogFooter
            formId="update-delivery-status-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              updateMutation.isPending
                ? t("management.delivery.updateStatus.updating") || "Updating..."
                : t("management.delivery.updateStatus.updateStatus") || "Update Status"
            }
            isPending={updateMutation.isPending}
            disabled={availableStatuses.length === 0}
          />
        }
      >
        <form id="update-delivery-status-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Current Status */}
          <div className="space-y-2">
            <Label>{t("management.delivery.updateStatus.currentStatus") || "Current Status"}</Label>
            <div>
              <Badge variant="secondary">
                {delivery?.status
                  ? t(`management.delivery.status.${getStatusTranslationKey(delivery.status)}`) ||
                    delivery.status
                  : ""}
              </Badge>
            </div>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="status">
              {t("management.delivery.updateStatus.newStatus") || "New Status"} *
            </Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status">
                <SelectValue
                  placeholder={
                    t("management.delivery.updateStatus.selectNewStatusPlaceholder") ||
                    "Select new status"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Received Date (only if status is RECEIVED) */}
          {newStatus === SupplierDeliveryStatus.RECEIVED && (
            <div className="space-y-2">
              <Label htmlFor="receivedDate">
                {t("management.delivery.updateStatus.receivedDate") || "Received Date"} *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="receivedDate"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-1 h-4 w-4 hidden sm:inline" />
                    {receivedDate
                      ? formatDate(receivedDate)
                      : t("management.delivery.updateStatus.selectReceivedDatePlaceholder") ||
                        "Select received date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={receivedDate}
                    onSelect={setReceivedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t("common.notes") || "Notes"}</Label>
            <Textarea
              id="notes"
              placeholder={
                t("management.delivery.updateStatus.notesPlaceholder") ||
                "Add notes about this status change..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
