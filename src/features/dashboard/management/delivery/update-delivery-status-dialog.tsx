"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [newStatus, setNewStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        { value: SupplierDeliveryStatus.IN_TRANSIT, label: t("management.delivery.status.inTransit") || "In Transit" },
        { value: SupplierDeliveryStatus.RECEIVED, label: t("management.delivery.status.received") || "Received" },
        { value: SupplierDeliveryStatus.CANCELLED, label: t("management.delivery.status.cancelled") || "Cancelled" }
      );
    } else if (currentStatus === SupplierDeliveryStatus.IN_TRANSIT) {
      statuses.push(
        { value: SupplierDeliveryStatus.RECEIVED, label: t("management.delivery.status.received") || "Received" },
        { value: SupplierDeliveryStatus.CANCELLED, label: t("management.delivery.status.cancelled") || "Cancelled" }
      );
    }

    return statuses;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStatus) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.updateStatus.selectNewStatus"),
        variant: "destructive",
      });
      return;
    }

    if (newStatus === SupplierDeliveryStatus.RECEIVED && !receivedDate) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.updateStatus.selectReceivedDate"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // TODO: API call to update delivery status
    // await updateDeliveryStatus(delivery.id, { status: newStatus, notes, receivedDate });

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      const statusLabel = getAvailableStatuses().find(s => s.value === newStatus)?.label || newStatus;
      const descriptionText = t("management.delivery.updateStatus.toasts.updated.description") || "Delivery status has been updated to {status}";
      toast({
        title: t("management.delivery.updateStatus.toasts.updated.title"),
        description: descriptionText.replace("{status}", statusLabel),
      });
      onOpenChange(false);
    }, 1000);
  };

  const availableStatuses = getAvailableStatuses();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("management.delivery.updateStatus.title")}</DialogTitle>
          <DialogDescription>
            {(t("management.delivery.updateStatus.description") || "Update delivery status").replace("{reference}", delivery?.deliveryReference || "")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Status */}
          <div className="space-y-2">
            <Label>{t("management.delivery.updateStatus.currentStatus")}</Label>
            <div>
              <Badge variant="secondary">{t(`management.delivery.status.${delivery?.status?.toLowerCase()}`) || delivery?.status}</Badge>
            </div>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="status">{t("management.delivery.updateStatus.newStatus")} *</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder={t("management.delivery.updateStatus.selectNewStatusPlaceholder")} />
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
              <Label htmlFor="receivedDate">{t("management.delivery.updateStatus.receivedDate")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="receivedDate"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {receivedDate ? formatDate(receivedDate) : t("management.delivery.updateStatus.selectReceivedDatePlaceholder")}
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
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("management.delivery.updateStatus.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || availableStatuses.length === 0}>
              {isSubmitting ? t("management.delivery.updateStatus.updating") : t("management.delivery.updateStatus.updateStatus")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
