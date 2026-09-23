"use client";

import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import type { DifferenceTone } from "../../lib/shift-summary";

interface EndShiftConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
  /** Already formatted in the store's currency. */
  expectedCash: string;
  countedCash: string;
  difference: string;
  differenceTone: DifferenceTone;
  otherPayments: string;
  note: string;
  pending: boolean;
  onConfirm: () => void;
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground min-w-0 text-sm">{label}</dt>
      <dd className={cn("shrink-0 text-sm font-semibold tabular-nums", className)}>{value}</dd>
    </div>
  );
}

/**
 * "Are you sure you want to end the shift?" — the last look at the numbers
 * before the drawer is signed off. Ending a shift cannot be undone (the server
 * refuses to re-close it, on purpose: that would rewrite a signed-off
 * variance), so this is a real gate, not a formality.
 */
export function EndShiftConfirmDialog({
  open,
  onOpenChange,
  storeName,
  expectedCash,
  countedCash,
  difference,
  differenceTone,
  otherPayments,
  note,
  pending,
  onConfirm,
}: EndShiftConfirmDialogProps) {
  const { t } = useI18n();

  const toneClass =
    differenceTone === "balanced"
      ? "text-emerald-600 dark:text-emerald-400"
      : differenceTone === "over"
        ? "text-amber-600 dark:text-amber-400"
        : differenceTone === "short"
          ? "text-destructive"
          : undefined;

  return (
    // Not dismissible mid-request: closing the dialog while the PATCH is in
    // flight would leave the cashier unsure whether the drawer was closed.
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <FormDialogLayout
        maxWidth="sm"
        title={t("pos.shift.confirmTitle")}
        description={t("pos.shift.confirmDesc")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:flex-none"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1 sm:flex-none"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {pending ? t("pos.shift.ending") : t("pos.shift.endShift")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Info className="size-6" aria-hidden />
            </div>
            <p className="text-muted-foreground text-sm">{storeName}</p>
          </div>

          <dl className="divide-y rounded-xl border px-3">
            <SummaryRow label={t("pages.expectedCash")} value={expectedCash} />
            <SummaryRow label={t("pos.shift.countedCash")} value={countedCash} />
            <SummaryRow
              label={t("pages.cashDifference")}
              value={difference}
              className={toneClass}
            />
            <SummaryRow label={t("pos.shift.paymentsTotal")} value={otherPayments} />
            <div className="py-1.5">
              <dt className="text-muted-foreground text-sm">{t("pos.shift.note")}</dt>
              <dd className="text-sm font-medium break-words whitespace-pre-wrap">
                {note || t("pos.shift.confirmNone")}
              </dd>
            </div>
          </dl>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
