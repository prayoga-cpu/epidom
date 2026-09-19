"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/lang/i18n-provider";
import { BARCODE_MAX_LENGTH } from "@/lib/validation/inventory.schemas";

/**
 * The optional Product barcode input, shared by the Add and Edit product dialogs.
 *
 * Expects the form to carry a `barcode: string` field. A duplicate reported by
 * the server (409, see product.service.ts) lands on this same field through
 * applyServerFieldErrors, so the <FormMessage/> below shows it under the input.
 */
export function BarcodeField<T extends FieldValues>({ control }: { control: Control<T> }) {
  const { t } = useI18n();

  return (
    <FormField
      control={control}
      name={"barcode" as Path<T>}
      render={({ field }) => (
        <FormItem className="space-y-0.5">
          <FormLabel className="text-sm">{t("promotions.product.barcode")}</FormLabel>
          <FormControl>
            <Input
              placeholder={t("promotions.product.barcodePlaceholder")}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={BARCODE_MAX_LENGTH}
              {...field}
              value={field.value ?? ""}
              // A keyboard-wedge scanner types the code and then presses Enter.
              // Left alone, that Enter would submit the whole product form the
              // moment the merchant scans into this box.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </FormControl>
          <FormDescription className="text-xs">
            {t("promotions.product.barcodeHint")}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
