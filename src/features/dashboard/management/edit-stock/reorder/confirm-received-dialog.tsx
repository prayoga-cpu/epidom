"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import type { SupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";

interface ConfirmReceivedDialogProps {
  order: SupplierOrder | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (order: SupplierOrder) => void;
  isPending: boolean;
}

/**
 * The second and last step of a supplier order: "did it arrive?". Yes adds
 * every line to stock and dates the receipt today. There is nothing to fill
 * in: no status to pick, no date. Not yet just closes, and the order's status
 * keeps moving on its own (see delivery-timing.ts).
 */
export function ConfirmReceivedDialog({
  order,
  onOpenChange,
  onConfirm,
  isPending,
}: ConfirmReceivedDialogProps) {
  const { t, formatDate } = useI18n();

  // Keep showing the last order while the dialog animates closed, instead of
  // blanking its content the moment the parent clears `order`.
  const [shown, setShown] = useState(order);
  if (order && order !== shown) setShown(order);

  return (
    <Dialog open={!!order} onOpenChange={(open) => !isPending && onOpenChange(open)}>
      <FormDialogLayout
        title={t("management.delivery.confirmReceived.title")}
        description={shown ? `${shown.supplier.name} · ${shown.orderNumber}` : undefined}
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("management.delivery.confirmReceived.notYet")}
            </Button>
            <Button type="button" onClick={() => order && onConfirm(order)} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("management.delivery.confirmReceived.confirm")}
            </Button>
          </>
        }
      >
        {shown && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("management.delivery.confirmReceived.addsToStock")}
              </p>
              <ul className="divide-y rounded-lg border">
                {shown.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Package className="text-muted-foreground h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.material.name}</p>
                        {item.expiryDate && (
                          <p className="text-muted-foreground text-xs">
                            {t("management.delivery.confirmReceived.expires").replace(
                              "{date}",
                              formatDate(item.expiryDate)
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-600 tabular-nums">
                      +{Number(item.quantity)} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("management.delivery.confirmReceived.notYetHint")}
            </p>
          </div>
        )}
      </FormDialogLayout>
    </Dialog>
  );
}
