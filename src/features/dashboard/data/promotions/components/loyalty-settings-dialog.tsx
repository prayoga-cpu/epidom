"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { MAX_LOYALTY_AMOUNT } from "@/lib/validation/loyalty.schemas";
import type { LoyaltySettingsDto } from "@/types/api/cashier";
import { useUpdateLoyaltySettings } from "../hooks/use-loyalty-settings";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { suggestedLoyaltyValues } from "../lib/loyalty-defaults";
import { AmountInput, IntegerInput } from "./amount-inputs";

interface LoyaltySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  settings: LoyaltySettingsDto;
}

const MIN_REDEEM_CEILING = 1_000_000;

/**
 * Field names match the API's (`enabled`, `spendPerPoint`, `pointValue`,
 * `minRedeemPoints`) so a server-side rejection lands under the right input.
 */
function createLoyaltyFormSchema(t: (key: string) => string) {
  return z
    .object({
      enabled: z.boolean(),
      // Optional so an unset amount is an EMPTY field (showing its suggested
      // placeholder), not a typed "0".
      spendPerPoint: z.number().optional(),
      pointValue: z.number().optional(),
      minRedeemPoints: z.number().optional(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      if (v.spendPerPoint !== undefined && v.spendPerPoint > MAX_LOYALTY_AMOUNT) {
        issue("spendPerPoint", t("promotions.validation.valueTooLarge"));
      }
      if (v.pointValue !== undefined && v.pointValue > MAX_LOYALTY_AMOUNT) {
        issue("pointValue", t("promotions.validation.valueTooLarge"));
      }
      if (v.minRedeemPoints !== undefined && v.minRedeemPoints > MIN_REDEEM_CEILING) {
        issue("minRedeemPoints", t("promotions.validation.valueTooLarge"));
      }

      // The program can only run when both amounts are positive: a zero
      // spend-per-point can't earn anything and a zero point value makes a
      // redemption worth nothing. This is the server's own rule
      // (`loyaltyEnableError`), evaluated per field rather than first-failure-only
      // so an owner who left both empty is told about both at once.
      if (v.enabled) {
        if (!(v.spendPerPoint !== undefined && v.spendPerPoint > 0)) {
          issue("spendPerPoint", t("promotions.validation.spendRequired"));
        }
        if (!(v.pointValue !== undefined && v.pointValue > 0)) {
          issue("pointValue", t("promotions.validation.pointValueRequired"));
        }
      }
    });
}

type LoyaltyFormValues = z.infer<ReturnType<typeof createLoyaltyFormSchema>>;

/**
 * The saved settings as form values. An amount of 0 means "never configured"
 * (the server stores exactly what the owner submitted, and an unconfigured store
 * reads back all zeros), so it maps to an EMPTY field — the suggested value then
 * shows as a placeholder rather than a "0" the owner would have to delete.
 */
function toFormValues(settings: LoyaltySettingsDto): LoyaltyFormValues {
  return {
    enabled: settings.enabled,
    spendPerPoint: settings.spendPerPoint > 0 ? settings.spendPerPoint : undefined,
    pointValue: settings.pointValue > 0 ? settings.pointValue : undefined,
    minRedeemPoints: settings.minRedeemPoints,
  };
}

export function LoyaltySettingsDialog({
  open,
  onOpenChange,
  storeId,
  settings,
}: LoyaltySettingsDialogProps) {
  const { t } = useI18n();
  const { symbol, currency, formatMoney } = usePromotionFormat();
  const updateSettings = useUpdateLoyaltySettings(storeId);
  const suggestion = useMemo(() => suggestedLoyaltyValues(currency), [currency]);

  const schema = useMemo(() => createLoyaltyFormSchema(t), [t]);
  const form = useForm<LoyaltyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(settings),
  });

  // Reload from the saved settings each time the dialog opens; only `open`
  // triggers it, so a background refetch never wipes what the owner is typing.
  useEffect(() => {
    if (open) form.reset(toFormValues(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [spendPerPoint, pointValue] = useWatch({
    control: form.control,
    name: ["spendPerPoint", "pointValue"],
  });
  const matchesSuggestion =
    spendPerPoint === suggestion.spendPerPoint && pointValue === suggestion.pointValue;

  async function onSubmit(values: LoyaltyFormValues) {
    // Submitted exactly as typed. Unset amounts go out as 0 — the suggestions are
    // placeholders and are never substituted here — and every amount is LITERAL in
    // the store's currency, never run through convertToBase().
    const body: LoyaltySettingsDto = {
      enabled: values.enabled,
      spendPerPoint: values.spendPerPoint ?? 0,
      pointValue: values.pointValue ?? 0,
      minRedeemPoints: values.minRedeemPoints ?? 0,
    };

    try {
      await updateSettings.mutateAsync(body);
      toast.success(t("promotions.toasts.loyaltySaved"));
      onOpenChange(false);
    } catch (error) {
      // Stay open so the owner can fix the field the server pointed at.
      const fieldSummary = applyServerFieldErrors(form, error);
      toast.error(t("common.error"), {
        description:
          fieldSummary ??
          (error instanceof Error ? error.message : t("promotions.toasts.saveFailed")),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("promotions.loyalty.dialog.title")}
        description={t("promotions.loyalty.dialog.description")}
        maxWidth="md"
        footer={
          <FormDialogFooter
            formId="loyalty-settings-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("common.actions.save")}
            isPending={updateSettings.isPending}
            variant="full-width"
          />
        }
      >
        <Form {...form}>
          <form
            id="loyalty-settings-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-2"
          >
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="loyalty-enabled" className="text-sm font-semibold">
                      {t("promotions.loyalty.dialog.enabled")}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {t("promotions.loyalty.dialog.enabledHint")}
                    </p>
                  </div>
                  <Switch
                    id="loyalty-enabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="spendPerPoint"
              render={({ field }) => (
                <FormItem className="pt-2">
                  <FormLabel>{t("promotions.loyalty.dialog.spendPerPoint")}</FormLabel>
                  <FormControl>
                    <AmountInput
                      adornment={symbol}
                      decimals={2}
                      min={0}
                      autoComplete="off"
                      // The suggestion is a PLACEHOLDER only: it is never the field's
                      // value and never sent unless the owner clicks "Use suggested
                      // values" below.
                      placeholder={String(suggestion.spendPerPoint)}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("promotions.loyalty.dialog.spendPerPointHint")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pointValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("promotions.loyalty.dialog.pointValue")}</FormLabel>
                  <FormControl>
                    <AmountInput
                      adornment={symbol}
                      decimals={4}
                      min={0}
                      autoComplete="off"
                      placeholder={String(suggestion.pointValue)}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>{t("promotions.loyalty.dialog.pointValueHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!matchesSuggestion && (
              <div className="pb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-full sm:w-auto"
                  onClick={() => {
                    form.setValue("spendPerPoint", suggestion.spendPerPoint, {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    });
                    form.setValue("pointValue", suggestion.pointValue, {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    });
                  }}
                >
                  {t("promotions.loyalty.dialog.useSuggested")}
                </Button>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("promotions.loyalty.dialog.suggestedHint")
                    .replace("{spend}", formatMoney(suggestion.spendPerPoint))
                    .replace("{value}", formatMoney(suggestion.pointValue))}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="minRedeemPoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("promotions.loyalty.dialog.minRedeemPoints")}</FormLabel>
                  <FormControl>
                    <IntegerInput
                      autoComplete="off"
                      placeholder="0"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("promotions.loyalty.dialog.minRedeemPointsHint")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
