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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

export interface RefundConfirmData {
  amount: number;
  reason?: string;
  /** Which tender gives the money back. Absent = "everything outstanding". */
  tenderId?: string;
}

/** One `OrderPayment` of the order being refunded. */
export interface RefundTender {
  id: string;
  /** Enum value, or the cashier's typed label for OTHER. */
  method: string;
  amount: number;
  refundedAmount: number;
}

/** Sentinel for "refund everything still outstanding, across every tender". */
const ALL_TENDERS = "__all__";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: RefundConfirmData) => void | Promise<void>;
  isSubmitting?: boolean;
  orderNumber?: string;
  /** Order.total minus any prior refundAmount — the max this refund can be. */
  remainingAmount: number;
  /**
   * The order's tenders. One (or none, for an order placed before
   * multi-tender) means there is no choice to make and no picker is shown.
   */
  payments?: RefundTender[];
}

export function RefundDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  orderNumber,
  remainingAmount,
  payments,
}: RefundDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number) => formatPriceRaw(value, currency);
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [tenderId, setTenderId] = useState<string>(ALL_TENDERS);

  const tenders = payments ?? [];
  // A cash refund leaves the drawer and a card refund doesn't, so on a bill
  // settled several ways the cashier has to say which one gives the money
  // back. With one tender (or none) there is nothing to choose.
  const isSplit = tenders.length > 1;
  const remainingOf = (tender: RefundTender) =>
    Math.round((tender.amount - tender.refundedAmount) * 100) / 100;
  const selectedTender = tenders.find((p) => p.id === tenderId) ?? null;

  // Full-refund-by-default: pre-fills the remaining amount every time the
  // dialog opens, so the common case (refund everything) is just Confirm —
  // a partial refund means editing the field down.
  useEffect(() => {
    if (open) {
      setAmountInput(remainingAmount > 0 ? String(remainingAmount) : "");
      setReason("");
      setTenderId(ALL_TENDERS);
    }
  }, [open, remainingAmount]);

  const handleTenderChange = (value: string) => {
    setTenderId(value);
    // Re-prefill to what that choice can actually refund: the whole
    // outstanding balance, or what is left on the chosen tender.
    const tender = tenders.find((p) => p.id === value);
    const max = tender ? Math.min(remainingOf(tender), remainingAmount) : remainingAmount;
    setAmountInput(max > 0 ? String(max) : "");
  };

  // "Everything outstanding" on a split bill is an all-or-nothing choice: the
  // server refuses to guess how to spread a partial refund across tenders
  // (see allocateRefund), so the field is locked to the full balance rather
  // than letting the cashier type an amount that is certain to be rejected.
  const isAmountLocked = isSplit && tenderId === ALL_TENDERS;
  const maxAmount = selectedTender
    ? Math.min(remainingOf(selectedTender), remainingAmount)
    : remainingAmount;

  const amount = Number(amountInput);
  const isValid = Number.isFinite(amount) && amount > 0 && amount <= maxAmount;

  const handleConfirm = async () => {
    if (!isValid) return;
    await onConfirm({
      amount,
      reason: reason.trim() || undefined,
      tenderId: selectedTender ? selectedTender.id : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("pos.refund.title")}</DialogTitle>
          {orderNumber && <DialogDescription>{orderNumber}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {isSplit && (
            <div className="space-y-2">
              <Label>{t("cashierPayments.refund.tenderLabel")}</Label>
              <RadioGroup value={tenderId} onValueChange={handleTenderChange} className="gap-1.5">
                {/* Whole rows are the tap target — a bare 16px radio is far
                    under the 40px minimum on a cashier's tablet. */}
                <label
                  htmlFor="refund-tender-all"
                  className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <RadioGroupItem value={ALL_TENDERS} id="refund-tender-all" />
                  <span className="flex-1">
                    {t("cashierPayments.refund.everythingOutstanding")}
                  </span>
                  <span className="font-medium">{formatPrice(remainingAmount)}</span>
                </label>
                {tenders.map((tender) => {
                  const left = remainingOf(tender);
                  return (
                    <label
                      key={tender.id}
                      htmlFor={`refund-tender-${tender.id}`}
                      className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm aria-disabled:opacity-50"
                      aria-disabled={left <= 0}
                    >
                      <RadioGroupItem
                        value={tender.id}
                        id={`refund-tender-${tender.id}`}
                        disabled={left <= 0}
                      />
                      <span className="flex-1">
                        {tender.method} — {formatPrice(tender.amount)}
                      </span>
                      <span className="text-muted-foreground">
                        {t("cashierPayments.refund.tenderLeft").replace(
                          "{amount}",
                          formatPrice(left)
                        )}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="refund-amount">{t("pos.refund.amountLabel")}</Label>
            <Input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={maxAmount}
              value={amountInput}
              disabled={isAmountLocked}
              onChange={(e) => setAmountInput(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {isAmountLocked
                ? t("cashierPayments.refund.pickTenderForPartial")
                : `${t("pos.refund.maxHint")} ${formatPrice(maxAmount)}`}
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
            className="h-11"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11"
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
