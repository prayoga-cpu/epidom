"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/lang/i18n-provider";
import { SupplierDelivery } from "@/types/entities";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { expectedCalendarDay } from "./delivery-timing";

interface AddEditDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: SupplierDelivery | null;
}

/** A local calendar day as the `YYYY-MM-DD` an `<input type="date">` holds. */
function toDateInput(day: Date): string {
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${mm}-${dd}`;
}

/**
 * "Change date or notes" for an order still awaiting delivery — typically the
 * supplier pushed the delivery back. Only the expected date and notes can
 * change: the lines were agreed with the supplier, and the status moves on its
 * own (Received, or Late once the date passes).
 */
export function AddEditDeliveryDialog({
  open,
  onOpenChange,
  delivery,
}: AddEditDeliveryDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  const updateMutation = useUpdateSupplierOrder(storeId, delivery?.id || "");

  useEffect(() => {
    if (delivery) {
      setExpectedDate(toDateInput(expectedCalendarDay(delivery.expectedDate)));
      setNotes(delivery.notes || "");
    }
  }, [delivery, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!expectedDate) {
      toast({
        title: t("common.validation.error"),
        description: t(
          "management.delivery.dialogs.addEditDelivery.validation.expectedDateRequired"
        ),
        variant: "destructive",
      });
      return;
    }

    if (!delivery) return;

    // Sent as YYYY-MM-DD, the same shape the create dialogs send, so every
    // expected date is stored the same way (UTC midnight of that day).
    updateMutation.mutate(
      { expectedDate, notes },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("management.delivery.openOrders.edit")}
        description={
          delivery ? `${delivery.supplier?.name ?? ""} · ${delivery.deliveryReference}` : undefined
        }
        maxWidth="md"
        footer={
          <FormDialogFooter
            formId="add-edit-delivery-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              updateMutation.isPending
                ? t("management.delivery.dialogs.addEditDelivery.updating")
                : t("management.delivery.dialogs.addEditDelivery.updateDelivery")
            }
            isPending={updateMutation.isPending}
          />
        }
      >
        <form id="add-edit-delivery-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expectedDate">
              {t("management.delivery.dialogs.addEditDelivery.expectedDate")} *
            </Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("management.delivery.dialogs.addEditDelivery.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("management.delivery.dialogs.addEditDelivery.additionalNotes")}
              rows={3}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
