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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { COUPON_CODE_PATTERN, MAX_PROMO_AMOUNT } from "@/lib/validation/promotions.schemas";
import type { CouponDto, CreateCouponBody, UpdateCouponBody } from "@/types/api/cashier";
import { useCreateCoupon, useUpdateCoupon } from "../hooks/use-coupons";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { fromLocalInputValue, toLocalInputValue } from "../lib/promotion-utils";
import { AmountInput, IntegerInput } from "./amount-inputs";
import { DiscountTypeToggle } from "./discount-type-toggle";

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Present = edit that coupon (its code is read-only); absent = create. */
  coupon?: CouponDto | null;
}

const MAX_USES_CEILING = 1_000_000;

/**
 * Field names match the API's so `applyServerFieldErrors` can put a server
 * message ("A coupon with this code already exists" on `code`, the end-date rule
 * on `validUntil`) under the right input.
 *
 * The schema mirrors the server's checks (createCouponSchema) with localized
 * messages, so an owner sees them before a round trip.
 */
function createCouponFormSchema(t: (key: string) => string, isEdit: boolean) {
  return z
    .object({
      code: z.string(),
      name: z.string().trim().max(80, t("promotions.validation.nameTooLong")),
      type: z.enum(["PERCENT", "FIXED"]),
      value: z.number().optional(),
      minSubtotal: z.number().optional(),
      maxUses: z.number().optional(),
      // datetime-local strings ("" = no bound).
      validFrom: z.string(),
      validUntil: z.string(),
      isActive: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      // The code can't be edited, so an existing one is never re-validated.
      if (!isEdit && !COUPON_CODE_PATTERN.test(v.code)) {
        issue("code", t("promotions.validation.codeInvalid"));
      }

      if (v.value === undefined || !Number.isFinite(v.value)) {
        issue("value", t("promotions.validation.valueRequired"));
      } else if (v.value <= 0) {
        issue("value", t("promotions.validation.valuePositive"));
      } else if (v.type === "PERCENT" && v.value > 100) {
        issue("value", t("promotions.validation.percentMax"));
      } else if (v.type === "FIXED" && v.value > MAX_PROMO_AMOUNT) {
        issue("value", t("promotions.validation.valueTooLarge"));
      }

      if (v.minSubtotal !== undefined && v.minSubtotal > MAX_PROMO_AMOUNT) {
        issue("minSubtotal", t("promotions.validation.valueTooLarge"));
      }

      if (v.maxUses !== undefined && v.maxUses < 1) {
        issue("maxUses", t("promotions.validation.maxUsesMin"));
      } else if (v.maxUses !== undefined && v.maxUses > MAX_USES_CEILING) {
        issue("maxUses", t("promotions.validation.valueTooLarge"));
      }

      // Both bounds are optional; only a pair can be out of order.
      if (v.validFrom && v.validUntil) {
        const from = new Date(v.validFrom).getTime();
        const until = new Date(v.validUntil).getTime();
        if (Number.isFinite(from) && Number.isFinite(until) && until <= from) {
          issue("validUntil", t("promotions.validation.untilAfterFrom"));
        }
      }
    });
}

type CouponFormValues = z.infer<ReturnType<typeof createCouponFormSchema>>;

function toFormValues(coupon?: CouponDto | null): CouponFormValues {
  return {
    code: coupon?.code ?? "",
    name: coupon?.name ?? "",
    type: coupon?.type ?? "PERCENT",
    value: coupon?.value,
    minSubtotal: coupon?.minSubtotal ?? undefined,
    maxUses: coupon?.maxUses ?? undefined,
    validFrom: toLocalInputValue(coupon?.validFrom),
    validUntil: toLocalInputValue(coupon?.validUntil),
    isActive: coupon?.isActive ?? true,
  };
}

/**
 * A datetime-local input only carries minutes. If the owner didn't touch the
 * field, send back the coupon's original instant instead of re-deriving it from
 * the minute-precision text — otherwise saving an unrelated change would quietly
 * shave the seconds off a bound that was set some other way (an import, an API).
 */
function resolveBound(local: string, initialLocal: string, initialIso: string | null | undefined) {
  if (local === initialLocal) return initialIso ?? null;
  return fromLocalInputValue(local);
}

export function CouponDialog({ open, onOpenChange, storeId, coupon }: CouponDialogProps) {
  const { t } = useI18n();
  const { symbol, currency } = usePromotionFormat();
  const createCoupon = useCreateCoupon(storeId);
  const updateCoupon = useUpdateCoupon(storeId);
  const isEdit = !!coupon;
  const isPending = createCoupon.isPending || updateCoupon.isPending;

  const schema = useMemo(() => createCouponFormSchema(t, isEdit), [t, isEdit]);
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(coupon),
  });

  // Reload from the row each time the dialog opens; only `open` triggers it, so a
  // background refetch never wipes what the owner is typing.
  useEffect(() => {
    if (open) form.reset(toFormValues(coupon));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const type = useWatch({ control: form.control, name: "type" });

  async function onSubmit(values: CouponFormValues) {
    if (values.value === undefined) return;

    // Every amount goes out exactly as typed — LITERAL in the store's currency,
    // never through convertToBase(). Empty optional fields become null (a null
    // bound means "no limit"), never 0 or "".
    const shared = {
      type: values.type,
      value: values.value,
      minSubtotal: values.minSubtotal ?? null,
      maxUses: values.maxUses ?? null,
      isActive: values.isActive,
    };
    const name = values.name.trim();

    try {
      if (coupon) {
        const initial = toFormValues(coupon);
        // No `code`: it is immutable and the server rejects a body that has one.
        const body: UpdateCouponBody = {
          ...shared,
          // An empty string clears the label server-side (it maps "" to null).
          name,
          validFrom: resolveBound(values.validFrom, initial.validFrom, coupon.validFrom),
          validUntil: resolveBound(values.validUntil, initial.validUntil, coupon.validUntil),
        };
        await updateCoupon.mutateAsync({ id: coupon.id, body });
        toast.success(t("promotions.toasts.couponUpdated"));
      } else {
        const body: CreateCouponBody = {
          ...shared,
          code: values.code,
          ...(name ? { name } : {}),
          validFrom: fromLocalInputValue(values.validFrom),
          validUntil: fromLocalInputValue(values.validUntil),
        };
        await createCoupon.mutateAsync(body);
        toast.success(t("promotions.toasts.couponCreated"));
      }
      onOpenChange(false);
    } catch (error) {
      // Stay open so the owner can fix the field the server pointed at (a
      // duplicate code, an end date before the start).
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
            ? t("promotions.coupons.dialog.editTitle")
            : t("promotions.coupons.dialog.addTitle")
        }
        description={t("promotions.coupons.dialog.description")}
        maxWidth="lg"
        footer={
          <FormDialogFooter
            formId="coupon-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              isEdit
                ? t("promotions.coupons.dialog.submitSave")
                : t("promotions.coupons.dialog.submitAdd")
            }
            isPending={isPending}
            variant="full-width"
          />
        }
      >
        <Form {...form}>
          <form
            id="coupon-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-2"
          >
            <div className="grid items-start gap-x-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("promotions.coupons.dialog.code")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={cn("h-10 font-mono tracking-wide", isEdit && "bg-muted")}
                        readOnly={isEdit}
                        maxLength={32}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={t("promotions.coupons.dialog.codePlaceholder")}
                        // Uppercase as it is typed (the server stores it uppercase and
                        // matches case-insensitively at the till), and drop whitespace —
                        // "summer 10" can only have meant "SUMMER10".
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase().replace(/\s/g, ""))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {isEdit
                        ? t("promotions.coupons.dialog.codeLockedHint")
                        : t("promotions.coupons.dialog.codeHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("promotions.coupons.dialog.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-10"
                        maxLength={80}
                        autoComplete="off"
                        placeholder={t("promotions.coupons.dialog.namePlaceholder")}
                      />
                    </FormControl>
                    <FormDescription>{t("promotions.coupons.dialog.nameHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid items-start gap-x-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("promotions.coupons.dialog.type")}</FormLabel>
                    <FormControl>
                      <DiscountTypeToggle
                        aria-label={t("promotions.coupons.dialog.type")}
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
                    <FormLabel>{t("promotions.coupons.dialog.value")}</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid items-start gap-x-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="minSubtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("promotions.coupons.dialog.minSubtotal")}</FormLabel>
                    <FormControl>
                      <AmountInput
                        adornment={symbol}
                        decimals={2}
                        min={0}
                        autoComplete="off"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("promotions.coupons.dialog.minSubtotalHint").replace(
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
                name="maxUses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("promotions.coupons.dialog.maxUses")}</FormLabel>
                    <FormControl>
                      <IntegerInput
                        autoComplete="off"
                        placeholder={t("promotions.coupons.dialog.maxUsesPlaceholder")}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {coupon && coupon.usedCount > 0
                        ? t("promotions.coupons.dialog.maxUsesUsedHint").replace(
                            "{count}",
                            String(coupon.usedCount)
                          )
                        : t("promotions.coupons.dialog.maxUsesHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid items-start gap-x-4 sm:grid-cols-2">
              {(["validFrom", "validUntil"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex min-h-10 items-center justify-between gap-2">
                        <FormLabel>
                          {name === "validFrom"
                            ? t("promotions.coupons.dialog.validFrom")
                            : t("promotions.coupons.dialog.validUntil")}
                        </FormLabel>
                        {/* iOS Safari's date sheet has no reliable "clear", and an empty
                            bound means "no limit" — so the way back must be visible. */}
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 px-2 text-xs"
                            onClick={() => field.onChange("")}
                          >
                            {t("promotions.coupons.dialog.clearDate")}
                          </Button>
                        )}
                      </div>
                      <FormControl>
                        <Input {...field} type="datetime-local" className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <p className="text-muted-foreground -mt-1 text-xs">
              {t("promotions.coupons.dialog.validityHint")}
            </p>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="mt-2 flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-active" className="text-sm font-semibold">
                      {t("promotions.coupons.dialog.active")}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {t("promotions.coupons.dialog.activeHint")}
                    </p>
                  </div>
                  <Switch
                    id="coupon-active"
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
