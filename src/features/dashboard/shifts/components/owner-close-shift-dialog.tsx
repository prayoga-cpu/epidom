"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/shared/decimal-input";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { closeShiftSchema, type CloseShiftInput } from "@/lib/validation/operations.schemas";
import type { CashReconciliationRow } from "@/lib/finance/report-aggregation";

interface OwnerCloseShiftDialogProps {
  storeId: string;
  /** The open till to close; null keeps the dialog shut. */
  row: CashReconciliationRow | null;
  onOpenChange: (open: boolean) => void;
  money: (value: number) => string;
}

/**
 * The owner's override for a till someone else left open. On the POS only the
 * person who opened a shift may finish it; when they've gone home without
 * doing so, this is how the drawer still gets counted and signed off. The
 * shift is recorded as closed from the Back Office.
 */
export function OwnerCloseShiftDialog({
  storeId,
  row,
  onOpenChange,
  money,
}: OwnerCloseShiftDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const form = useForm<CloseShiftInput>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { notes: "" },
  });

  useEffect(() => {
    if (row) form.reset({ notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.shiftId]);

  const close = useMutation({
    mutationFn: (body: CloseShiftInput) =>
      apiClient.post(`/stores/${storeId}/shifts/${row!.shiftId}/close`, body),
    onSettled: () => {
      // Closed here or (409) already closed elsewhere — either way the table is stale.
      queryClient.invalidateQueries({ queryKey: ["shifts-report", storeId] });
      queryClient.invalidateQueries({ queryKey: ["shifts-cash-log", storeId] });
      queryClient.invalidateQueries({ queryKey: ["finance-cash-reconciliation", storeId] });
      queryClient.invalidateQueries({ queryKey: ["operations-status", storeId] });
    },
  });

  const onSubmit = form.handleSubmit(async ({ closingCash, notes }) => {
    try {
      await close.mutateAsync({ closingCash, notes: notes?.trim() || undefined });
      toast.success(t("pages.shiftsCloseDone"));
      onOpenChange(false);
    } catch (error) {
      const status = error instanceof ApiClientError ? error.status : null;
      toast.error(status === 409 ? t("pos.shift.alreadyEnded") : t("pages.shiftsCloseFailed"));
      if (status === 409) onOpenChange(false);
    }
  });

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("pages.shiftsCloseTitle").replace("{name}", row?.staffName ?? "")}
        description={t("pages.shiftsCloseDesc")}
        footer={
          <FormDialogFooter
            formId="owner-close-shift-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("pages.shiftsCloseAction")}
            isPending={close.isPending}
            variant="full-width"
          />
        }
      >
        <form id="owner-close-shift-form" onSubmit={onSubmit} className="space-y-4">
          {row && (
            <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
              <span className="text-muted-foreground text-sm">
                {t("pages.financeExpectedCash")}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {money(row.expectedCash)}
              </span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="owner-close-counted-cash">{t("pos.shift.countedCash")}</Label>
            <Controller
              control={form.control}
              name="closingCash"
              render={({ field }) => (
                <DecimalInput
                  id="owner-close-counted-cash"
                  className="h-12 text-lg"
                  decimals={2}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            {form.formState.errors.closingCash ? (
              <p className="text-destructive text-xs">{t("pos.shift.countedRequired")}</p>
            ) : (
              <p className="text-muted-foreground text-xs">{t("pos.shift.countedCashHint")}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="owner-close-notes">{t("pos.shift.note")}</Label>
            <Textarea
              id="owner-close-notes"
              rows={3}
              maxLength={500}
              className="resize-none"
              placeholder={t("pos.shift.notePlaceholder")}
              {...form.register("notes")}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
