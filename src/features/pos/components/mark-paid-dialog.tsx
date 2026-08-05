"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { SettlePaymentMethod } from "../types/pos.types";

// Same set offered at POS checkout (see pos-checkout-dialog.tsx), minus
// PAY_LATER — marking an order paid always means a real method was used.
const SETTLE_PAYMENT_METHODS: { value: SettlePaymentMethod; label: string }[] = [
  { value: "CASH", label: "cash" },
  { value: "QRIS", label: "QRIS" },
  { value: "GOPAY", label: "GoPay" },
  { value: "OVO", label: "OVO" },
  { value: "DANA", label: "DANA" },
  { value: "SHOPEEPAY", label: "ShopeePay" },
  { value: "BANK_TRANSFER", label: "virtualAccount" },
  { value: "STRIPE_CARD", label: "creditCard" },
];

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
  const { t } = useI18n();
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

  const handleConfirm = async () => {
    await onConfirm({ paymentMethod, paymentNote: note.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("pos.markPaid.title")}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label>{t("pos.checkout.paymentMethod")}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as SettlePaymentMethod)}
              className="grid grid-cols-2 gap-2"
            >
              {SETTLE_PAYMENT_METHODS.map((m) => (
                <Label
                  key={m.value}
                  htmlFor={`mark-paid-method-${m.value}`}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal",
                    paymentMethod === m.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-foreground/40"
                  )}
                >
                  <RadioGroupItem value={m.value} id={`mark-paid-method-${m.value}`} />
                  {m.label === "cash"
                    ? t("pos.checkout.cash")
                    : m.label === "virtualAccount"
                      ? t("pos.markPaid.virtualAccount")
                      : m.label === "creditCard"
                        ? t("pos.markPaid.creditCard")
                        : m.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mark-paid-note">{t("pos.markPaid.noteLabel")}</Label>
            <Textarea
              id="mark-paid-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pos.markPaid.notePlaceholder")}
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
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pos.orderCard.markPaid")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
