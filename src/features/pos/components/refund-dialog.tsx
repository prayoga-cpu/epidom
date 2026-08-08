"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export interface RefundConfirmData {
  amount: number;
  reason?: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: RefundConfirmData) => void | Promise<void>;
  isSubmitting?: boolean;
  orderNumber?: string;
  /** Order.total minus any prior refundAmount — the max this refund can be. */
  remainingAmount: number;
}

export function RefundDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  orderNumber,
  remainingAmount,
}: RefundDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number) => formatPriceRaw(value, currency);
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");

  // Full-refund-by-default: pre-fills the remaining amount every time the
  // dialog opens, so the common case (refund everything) is just Confirm —
  // a partial refund means editing the field down.
  useEffect(() => {
    if (open) {
      setAmountInput(remainingAmount > 0 ? String(remainingAmount) : "");
      setReason("");
    }
  }, [open, remainingAmount]);

  const amount = Number(amountInput);
  const isValid = Number.isFinite(amount) && amount > 0 && amount <= remainingAmount;

  const handleConfirm = async () => {
    if (!isValid) return;
    await onConfirm({ amount, reason: reason.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("pos.refund.title")}</DialogTitle>
          {orderNumber && <DialogDescription>{orderNumber}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">{t("pos.refund.amountLabel")}</Label>
            <Input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={remainingAmount}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t("pos.refund.maxHint")} {formatPrice(remainingAmount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">{t("pos.refund.reasonLabel")}</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("pos.refund.reasonPlaceholder")}
              className="resize-none"
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pos.refund.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
