import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  getCurrencySymbol,
  roundToSixDecimals,
  formatDerivedUnitCost,
} from "@/lib/utils/formatting";
import { useI18n } from "@/components/lang/i18n-provider";

export { roundToSixDecimals, formatDerivedUnitCost };

/**
 * One supplier row's Purchase Quantity + Purchase Price inputs, deriving that
 * row's `price` (cost per one Material.unit from this supplier) the same way
 * the main Unit Cost is derived. Extracted into its own component (rather
 * than inlined in a `.map()`) because each row needs its own `useEffect` —
 * calling hooks inside a loop directly would break across add/remove-row
 * re-renders.
 */
export function SupplierPackPriceFields({
  form,
  index,
  currency,
}: {
  form: UseFormReturn<any>;
  index: number;
  currency: string;
}) {
  const { t } = useI18n();
  const purchaseQuantityValue = form.watch(`suppliers.${index}.purchaseQuantity`);
  const purchasePriceValue = form.watch(`suppliers.${index}.purchasePrice`);

  useEffect(() => {
    const qty = purchaseQuantityValue ?? 1;
    const price = purchasePriceValue ?? 0;
    if (!(qty > 0)) return;
    form.setValue(`suppliers.${index}.price`, roundToSixDecimals(price / qty), {
      shouldValidate: true,
      shouldDirty: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseQuantityValue, purchasePriceValue]);

  const priceValue = form.watch(`suppliers.${index}.price`);
  const hint =
    priceValue && priceValue > 0
      ? `≈ ${getCurrencySymbol(currency)}${formatDerivedUnitCost(priceValue)}`
      : undefined;

  return (
    <div className="flex items-start gap-4">
      <FormField
        control={form.control}
        name={`suppliers.${index}.purchaseQuantity` as any}
        render={({ field }) => (
          <FormItem className="flex-1 space-y-1">
            <FormLabel className="text-xs font-medium">
              {t("data.materials.form.supplierPurchaseQuantity")}
            </FormLabel>
            <FormControl>
              <DecimalInput
                decimals={3}
                min={0}
                placeholder="1000"
                className="h-9"
                value={field.value as number | undefined}
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

      <FormField
        control={form.control}
        name={`suppliers.${index}.purchasePrice` as any}
        render={({ field }) => (
          <FormItem className="flex-1 space-y-1">
            <FormLabel className="text-xs font-medium">
              {t("data.materials.form.supplierPrice")} ({getCurrencySymbol(currency)})
            </FormLabel>
            <FormControl>
              <DecimalInput
                decimals={2}
                min={0}
                placeholder="25.00"
                className="h-9"
                value={field.value as number | undefined}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            {hint && <FormDescription className="text-xs">{hint}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
