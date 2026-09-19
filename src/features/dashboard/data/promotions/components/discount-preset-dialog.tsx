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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { MAX_PROMO_AMOUNT } from "@/lib/validation/promotions.schemas";
import type { DiscountPresetDto, UpsertDiscountPresetBody } from "@/types/api/cashier";
import { useCreateDiscountPreset, useUpdateDiscountPreset } from "../hooks/use-discount-presets";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { AmountInput } from "./amount-inputs";
import { DiscountTypeToggle } from "./discount-type-toggle";

interface DiscountPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Present = edit that preset; absent = create a new one. */
  preset?: DiscountPresetDto | null;
}

/**
 * Field names match the API's (`name`, `type`, `value`, `isActive`) on purpose:
 * `applyServerFieldErrors` routes the server's `error.details[].field` straight
 * onto the input of the same name.
 */
function createPresetSchema(t: (key: string) => string) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, t("promotions.validation.nameRequired"))
        .max(60, t("promotions.validation.nameTooLong")),
      type: z.enum(["PERCENT", "FIXED"]),
      // Optional in the type so an empty field is representable, then required in
      // superRefine — keeps the form's value type honest (`number | undefined`).
      value: z.number().optional(),
      isActive: z.boolean(),
    })
    .superRefine((v, ctx) => {
      // Same bounds the server enforces (discountValueError): 0 < v <= 100 for a
      // percentage, 0 < v <= MAX_PROMO_AMOUNT for a fixed amount.
      let message: string | null = null;
      if (v.value === undefined || !Number.isFinite(v.value)) {
        message = t("promotions.validation.valueRequired");
      } else if (v.value <= 0) {
        message = t("promotions.validation.valuePositive");
      } else if (v.type === "PERCENT" && v.value > 100) {
        message = t("promotions.validation.percentMax");
      } else if (v.type === "FIXED" && v.value > MAX_PROMO_AMOUNT) {
        message = t("promotions.validation.valueTooLarge");
      }
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message });
    });
}

type PresetFormValues = z.infer<ReturnType<typeof createPresetSchema>>;

function toFormValues(preset?: DiscountPresetDto | null): PresetFormValues {
  return {
    name: preset?.name ?? "",
    type: preset?.type ?? "PERCENT",
    value: preset?.value,
    isActive: preset?.isActive ?? true,
  };
}

export function DiscountPresetDialog({
  open,
  onOpenChange,
  storeId,
  preset,
}: DiscountPresetDialogProps) {
  const { t } = useI18n();
  const { symbol, currency } = usePromotionFormat();
  const createPreset = useCreateDiscountPreset(storeId);
  const updatePreset = useUpdateDiscountPreset(storeId);
  const isEdit = !!preset;
  const isPending = createPreset.isPending || updatePreset.isPending;

  const schema = useMemo(() => createPresetSchema(t), [t]);
  const form = useForm<PresetFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(preset),
  });

  // Reload from the row each time the dialog opens, so a cancelled edit never
  // leaks into the next open. Only `open` is a trigger: a background refetch of
  // the list must not wipe what the owner is typing.
  useEffect(() => {
    if (open) form.reset(toFormValues(preset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const type = useWatch({ control: form.control, name: "type" });

  async function onSubmit(values: PresetFormValues) {
    if (values.value === undefined) return;
    // `value` goes out exactly as typed: presets are LITERAL amounts in the
    // store's currency, so it must never pass through convertToBase().
    const body: UpsertDiscountPresetBody = {
      name: values.name.trim(),
      type: values.type,
      value: values.value,
      isActive: values.isActive,
    };

    try {
      if (preset) {
        await updatePreset.mutateAsync({ id: preset.id, body });
        toast.success(t("promotions.toasts.presetUpdated"));
      } else {
        await createPreset.mutateAsync(body);
        toast.success(t("promotions.toasts.presetCreated"));
      }
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
        title={
          isEdit
            ? t("promotions.presets.dialog.editTitle")
            : t("promotions.presets.dialog.addTitle")
        }
        description={t("promotions.presets.dialog.description")}
        maxWidth="md"
        footer={
          <FormDialogFooter
            formId="discount-preset-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              isEdit
                ? t("promotions.presets.dialog.submitSave")
                : t("promotions.presets.dialog.submitAdd")
            }
            isPending={isPending}
            variant="full-width"
          />
        }
      >
        <Form {...form}>
          <form
            id="discount-preset-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("promotions.presets.dialog.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-10"
                      maxLength={60}
                      autoComplete="off"
                      placeholder={t("promotions.presets.dialog.namePlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("promotions.presets.dialog.type")}</FormLabel>
                  <FormControl>
                    <DiscountTypeToggle
                      aria-label={t("promotions.presets.dialog.type")}
                      value={field.value}
                      onChange={(next) => {
                        field.onChange(next);
                        // The 100 cap only applies to a percentage, so re-check a
                        // value that is already there as soon as the type changes.
                        if (form.getValues("value") !== undefined) void form.trigger("value");
                      }}
                      labels={{
                        PERCENT: t("promotions.type.percent"),
                        FIXED: t("promotions.type.fixed"),
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("promotions.presets.dialog.value")}</FormLabel>
                  <FormControl>
                    <AmountInput
                      adornment={type === "PERCENT" ? "%" : symbol}
                      adornmentPosition={type === "PERCENT" ? "end" : "start"}
                      decimals={2}
                      min={0}
                      autoComplete="off"
                      placeholder={type === "PERCENT" ? "10" : undefined}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {type === "PERCENT"
                      ? t("promotions.presets.dialog.valuePercentHint")
                      : t("promotions.presets.dialog.valueFixedHint").replace(
                          "{currency}",
                          currency
                        )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="mt-2 flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="preset-active" className="text-sm font-semibold">
                      {t("promotions.presets.dialog.active")}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {t("promotions.presets.dialog.activeHint")}
                    </p>
                  </div>
                  <Switch
                    id="preset-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
