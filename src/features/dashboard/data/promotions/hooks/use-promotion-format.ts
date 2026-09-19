import { useMemo } from "react";
import type { DiscountKindDto } from "@/types/api/cashier";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { formatDiscountValue, formatLiteralAmount } from "../lib/promotion-utils";

/**
 * Money helpers bound to the store's display currency.
 *
 * Presets, coupon amounts, spend-per-point and point value are LITERAL amounts
 * in that currency. The provider's `formatPrice(v)` alone would read them as IDR
 * and convert; passing `currency` as the second argument (done inside
 * `formatLiteralAmount`) is what turns the conversion off. Route every amount
 * through `formatMoney` and never call `formatPrice` directly on these values.
 */
export function usePromotionFormat() {
  const { currency, formatPrice: raw } = useCurrency();
  const { intlLocale } = useI18n();

  return useMemo(() => {
    const formatMoney = (value: number) => formatLiteralAmount(value, currency, raw);
    return {
      currency,
      /** For input adornments — "€", "Rp", "$". */
      symbol: getCurrencySymbol(currency),
      formatMoney,
      formatDiscount: (rule: { type: DiscountKindDto; value: number }) =>
        formatDiscountValue(rule, { formatMoney, intlLocale }),
    };
  }, [currency, raw, intlLocale]);
}
