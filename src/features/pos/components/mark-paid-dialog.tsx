"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { SettlePaymentMethod } from "../types/pos.types";
import { PaymentMethodChip } from "./payment-method-chip";
import { mapPaymentMethodLabel, orderPaymentMethodGroups } from "../lib/order-status-display";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface MarkPaidConfirmData {
  paymentMethod: SettlePaymentMethod;
  paymentNote?: string;
}

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: MarkPaidConfirmData) => void | Promise<void>;
  isSubmitting?: boolean;
  /** e.g. an order number, or "3 orders selected" for the bulk action */
  description?: string;
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  description,
}: MarkPaidDialogProps) {
  const { t, locale } = useI18n();
  const [paymentMethod, setPaymentMethod] = useState<SettlePaymentMethod>("CASH");
  const [note, setNote] = useState("");

  // Reset to defaults every time the dialog is (re)opened, so a previous
  // order's selection/note never leaks into the next one.
  useEffect(() => {
    if (open) {
      setPaymentMethod("CASH");
      setNote("");
    }
  }, [open]);

  const isOther = paymentMethod === "OTHER";
  const otherNoteMissing = isOther && !note.trim();

  const handleConfirm = async () => {
    await onConfirm({ paymentMethod, paymentNote: note.trim() || undefined });
  };

  // Same grouping as POS checkout (see pos-checkout-dialog.tsx) minus
  // PAY_LATER — marking an order paid always means a real method was used.
  const paymentMethodGroups = orderPaymentMethodGroups(locale);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + flex column + a scrollable middle: the payment-method grid
          grows with the store's enabled markets (worldwide + Indonesia +
          France + Other), which overflows short viewports. dvh (not vh) so
          iOS Safari's toolbar doesn't push the footer out of reach. */}
      <DialogContent className="flex max-h-[calc(85dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("pos.markPaid.title")}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto">
          <div className="space-y-4">
            <Label>{t("pos.checkout.paymentMethod")}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as SettlePaymentMethod)}
              className="space-y-3"
            >
              {paymentMethodGroups.map((group) => (
                <div key={group.key} className="space-y-2">
                  {group.key !== "common" && (
                    <p className="text-muted-foreground text-xs font-semibold uppercase">
                      {t(`pos.checkout.market${capitalize(group.key)}`)}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {group.methods.map((method) => (
                      <PaymentMethodChip
                        key={method}
                        idPrefix="mark-paid-method"
                        value={method}
                        selected={paymentMethod === method}
                        label={mapPaymentMethodLabel(t, method)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <PaymentMethodChip
                  idPrefix="mark-paid-method"
                  value="OTHER"
                  selected={isOther}
                  label={t("pos.checkout.other")}
                />
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mark-paid-note">
              {isOther ? t("pos.checkout.customPaymentMethodLabel") : t("pos.markPaid.noteLabel")}
            </Label>
            <Textarea
              id="mark-paid-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isOther
                  ? t("pos.checkout.customPaymentMethodPlaceholder")
                  : t("pos.markPaid.notePlaceholder")
              }
              className="resize-none"
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting || otherNoteMissing}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pos.orderCard.markPaid")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
