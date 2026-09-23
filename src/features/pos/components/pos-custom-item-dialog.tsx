"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";
import { usePosCart } from "../hooks/use-pos-cart";

/** Mirrors the order schema's bounds for a custom line — the form must not be
 * able to produce a value the server would reject. */
export const CUSTOM_ITEM_NAME_MAX = 80;
export const CUSTOM_ITEM_PRICE_MAX = 100_000_000;
export const CUSTOM_ITEM_QUANTITY_MAX = 999;
const NOTE_MAX = 300;

const DEPARTMENTS = ["KITCHEN", "BAR", "NONE"] as const;
type DepartmentChoice = (typeof DEPARTMENTS)[number];

// Messages are i18n keys, resolved with t() where they render.
const customItemSchema = z
  .object({
    name: z.string().trim().min(1, "cashierCart.customItem.nameRequired").max(CUSTOM_ITEM_NAME_MAX),
    unitPrice: z.number().optional(),
    quantity: z.number().int().min(1).max(CUSTOM_ITEM_QUANTITY_MAX),
    department: z.enum(DEPARTMENTS),
    notes: z.string().max(NOTE_MAX).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.unitPrice === undefined || !(value.unitPrice > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitPrice"],
        message: "cashierCart.customItem.priceRequired",
      });
    } else if (value.unitPrice > CUSTOM_ITEM_PRICE_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitPrice"],
        message: "cashierCart.customItem.priceTooHigh",
      });
    }
  });
type CustomItemValues = z.infer<typeof customItemSchema>;

const DEFAULTS: CustomItemValues = {
  name: "",
  unitPrice: undefined,
  quantity: 1,
  department: "NONE",
  notes: "",
};

interface PosCustomItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Custom Item: an ad-hoc line with no MenuItem behind it (a delivery fee, a
 * one-off dish) — description, price, quantity, a printer area and a note.
 *
 * Named "Custom Item" everywhere in the UI. It is unrelated to "Custom
 * Products" (`Product.productLine === "CUSTOM"`), which is a different feature.
 *
 * The price is literal in the store's display currency (never IDR-converted),
 * hence `getCurrencySymbol(currency)` on the input. The printer area routes the
 * line: Kitchen / Bar go to that station's display, None means "no prep area"
 * and the line starts already served.
 */
export function PosCustomItemDialog({ open, onOpenChange }: PosCustomItemDialogProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const addCustomItem = usePosCart((s) => s.addCustomItem);

  const form = useForm<CustomItemValues>({
    resolver: zodResolver(customItemSchema),
    defaultValues: DEFAULTS,
  });

  // Every open starts blank — an abandoned entry must not resurface on the next one.
  useEffect(() => {
    if (open) form.reset(DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = (values: CustomItemValues) => {
    addCustomItem({
      name: values.name.trim(),
      unitPrice: values.unitPrice as number,
      quantity: values.quantity,
      notes: values.notes?.trim() || undefined,
      department: values.department === "NONE" ? null : values.department,
    });
    onOpenChange(false);
  };

  const departmentLabel: Record<DepartmentChoice, string> = {
    KITCHEN: t("cashierCart.customItem.kitchen"),
    BAR: t("cashierCart.customItem.bar"),
    NONE: t("cashierCart.customItem.none"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.customItem.title")}
        maxWidth="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 touch-manipulation"
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            {/* form= (not a wrapping <form>): DialogContent renders through a
                Portal, so a <form> around FormDialogLayout never contains this
                button in the real DOM. */}
            <Button type="submit" form="pos-custom-item-form" className="h-11 touch-manipulation">
              {t("cashierCart.customItem.add")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id="pos-custom-item-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("cashierCart.customItem.description")}</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      autoFocus
                      maxLength={CUSTOM_ITEM_NAME_MAX}
                      placeholder={t("cashierCart.customItem.descriptionPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("cashierCart.customItem.price")}</FormLabel>
                    <div className="relative">
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        {getCurrencySymbol(currency)}
                      </span>
                      <FormControl>
                        <DecimalInput
                          decimals={2}
                          min={0}
                          placeholder="0"
                          className="h-11 pl-8 text-base font-medium"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                    </div>
                    <TranslatedMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("cashierCart.customItem.quantity")}</FormLabel>
                    <FormControl>
                      <QuantityStepper
                        value={field.value}
                        onChange={field.onChange}
                        decreaseLabel={t("cashierCart.item.decrease")}
                        increaseLabel={t("cashierCart.item.increase")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("cashierCart.customItem.printerArea")}</FormLabel>
                  <FormControl>
                    <div
                      role="radiogroup"
                      aria-label={t("cashierCart.customItem.printerArea")}
                      className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
                    >
                      {DEPARTMENTS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={field.value === value}
                          onClick={() => field.onChange(value)}
                          className={cn(
                            "h-11 min-w-0 touch-manipulation rounded-md px-2 text-sm font-medium transition-colors",
                            field.value === value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">{departmentLabel[value]}</span>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    {t(
                      field.value === "NONE"
                        ? "cashierCart.customItem.noneHint"
                        : "cashierCart.customItem.areaHint"
                    )}
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("cashierCart.customItem.note")}</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-16 resize-none"
                      maxLength={NOTE_MAX}
                      placeholder={t("pos.checkout.notesPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}

/** FormMessage prints the raw zod message; ours are i18n keys, so this resolves them
 * with t(). Keeps FormMessage's reserved height so an error doesn't shift the layout. */
function TranslatedMessage() {
  const { t } = useI18n();
  const { error, formMessageId } = useFormField();
  const key = error?.message ? String(error.message) : null;
  return (
    <p
      id={formMessageId}
      role={key ? "alert" : undefined}
      className={cn("text-destructive min-h-[1.25rem] text-sm", !key && "invisible")}
    >
      {key ? t(key) : "\u00A0"}
    </p>
  );
}

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

function QuantityStepper({ value, onChange, decreaseLabel, increaseLabel }: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(CUSTOM_ITEM_QUANTITY_MAX, Math.max(1, n));
  return (
    <div className="bg-muted/50 flex w-fit items-center gap-0.5 rounded-md border p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 touch-manipulation rounded-sm"
        disabled={value <= 1}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus className="h-4 w-4" />
        <span className="sr-only">{decreaseLabel}</span>
      </Button>
      <span className="w-9 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 touch-manipulation rounded-sm"
        disabled={value >= CUSTOM_ITEM_QUANTITY_MAX}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus className="h-4 w-4" />
        <span className="sr-only">{increaseLabel}</span>
      </Button>
    </div>
  );
}
