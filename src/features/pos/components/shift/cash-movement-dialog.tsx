"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { CashMovementType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecimalInput } from "@/components/shared/decimal-input";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  createCashMovementSchema,
  type CreateCashMovementInput,
} from "@/lib/validation/operations.schemas";
import {
  INBOUND_CASH_MOVEMENT_TYPES,
  OUTBOUND_CASH_MOVEMENT_TYPES,
} from "@/lib/finance/cash-drawer";
import { useRecordCashMovement } from "../../hooks/use-cash-movements";

// Inbound first, then outbound — the picker reads as "money in / money out"
// without a second hand-written list of the five types drifting from the
// direction table in lib/finance/cash-drawer.ts.
const CASH_MOVEMENT_TYPES: CashMovementType[] = [
  ...INBOUND_CASH_MOVEMENT_TYPES,
  ...OUTBOUND_CASH_MOVEMENT_TYPES,
];

interface CashMovementDialogProps {
  storeId: string;
  /** The persona recording it. */
  staffMemberId: string;
  /** The open till to attach it to. Null is legitimate — see submit below. */
  shiftId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cash that moves through the drawer outside of sales — tips, float top-ups,
 * paid-outs, safe drops, tip payouts. Deliberately its own dialog rather than a
 * field on the finish screen: a paid-out or a safe drop happens mid-shift, and
 * asking a cashier to remember it until close is how the "where did the money
 * go" answer gets lost.
 */
export function CashMovementDialog({
  storeId,
  staffMemberId,
  shiftId,
  open,
  onOpenChange,
}: CashMovementDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const recordMovement = useRecordCashMovement(storeId);

  const defaults: Partial<CreateCashMovementInput> = {
    staffMemberId,
    pin: "",
    type: "TIP",
    amount: undefined,
    reason: "",
  };
  const form = useForm<CreateCashMovementInput>({
    // The very schema the POST route validates with — the reason-required rule
    // for outbound types is stated once and enforced on both sides.
    resolver: zodResolver(createCashMovementSchema),
    defaultValues: defaults,
  });
  const selectedType = form.watch("type");
  const reasonRequired = OUTBOUND_CASH_MOVEMENT_TYPES.includes(selectedType);

  // Every close path goes through here. Closing without resetting left the
  // abandoned amount, reason and any red validation errors sitting in the
  // dialog, so the next Cash In / Out — often a different movement entirely —
  // opened pre-filled with the last one's numbers.
  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) form.reset(defaults);
  };

  const submit = (values: CreateCashMovementInput) =>
    recordMovement.mutate(
      // Attach the till only when one is actually open. The API rejects a
      // closed session on purpose (it would rewrite a signed-off variance) and
      // accepts no session at all, which is the honest shape for cash moved
      // before the first shift or after the last one.
      { ...values, ...(shiftId && { shiftId }) },
      {
        // The hook already refreshes the ledger and the expected-cash surfaces;
        // this one is local to My Schedule's history list.
        onSuccess: () => {
          toast.success(t("pages.cashMovementSaved"));
          queryClient.invalidateQueries({ queryKey: ["schedule-my-log", storeId] });
          setOpen(false);
        },
        onError: () => toast.error(t("pages.cashMovementFailed")),
      }
    );

  const typeLabel = (type: CashMovementType) => {
    switch (type) {
      case "TIP":
        return t("pages.cashMovementTypeTip");
      case "PETTY_IN":
        return t("pages.cashMovementTypePettyIn");
      case "PETTY_OUT":
        return t("pages.cashMovementTypePettyOut");
      case "DROP":
        return t("pages.cashMovementTypeDrop");
      case "PAYOUT":
        return t("pages.cashMovementTypePayout");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <FormDialogLayout
        title={t("pages.cashMovementTitle")}
        description={t("pages.cashMovementDesc")}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:flex-none"
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="shift-cash-movement-form"
              className="h-11 flex-1 sm:flex-none"
              disabled={recordMovement.isPending}
            >
              {t("pages.cashMovementSubmit")}
            </Button>
          </>
        }
      >
        <form
          id="shift-cash-movement-form"
          onSubmit={form.handleSubmit(submit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="shift-movement-type">{t("pages.cashMovementType")}</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="shift-movement-type" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASH_MOVEMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="min-h-10">
                        {typeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="shift-movement-amount">{t("pages.cashMovementAmount")}</Label>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <DecimalInput
                  id="shift-movement-amount"
                  className="h-11"
                  decimals={2}
                  // Always positive: direction comes from the type above, so a
                  // minus sign here would double-negate a paid-out.
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            {form.formState.errors.amount && (
              <p className="text-destructive text-xs">{t("common.validation.positive")}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="shift-movement-reason">
              {t("pages.cashMovementReason")}
              {reasonRequired && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <Textarea
              id="shift-movement-reason"
              rows={2}
              maxLength={500}
              className="min-h-0"
              placeholder={t("pages.cashMovementReasonPlaceholder")}
              {...form.register("reason")}
            />
            {/* The schema raises this for the outbound types; the server
                re-raises it, so the client is a courtesy, not the guard. */}
            {form.formState.errors.reason && (
              <p className="text-destructive text-xs">{t("pages.cashMovementReasonRequired")}</p>
            )}
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
