"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePosCart } from "../hooks/use-pos-cart";
import { discountSourceLabel, formatRatePercent } from "../lib/cart-format";

interface PosCartTotalsProps {
  /** The store's own tax name (e.g. "TVA", "PPN") when it set one; falls back to the generic "Tax". */
  taxLabel?: string | null;
}

/**
 * The bottom of the live bill: Discount, Points redeemed, Sub-Total, Service
 * Charge (15%), Tax (10%), Total. Reads the cart store directly so the numbers
 * are the same ones checkout and the server will use — nothing is re-derived
 * here except labels.
 *
 * The percentages come from `financeSettings` (a 0–1 fraction), and the tax
 * row says "included" for tax-inclusive stores, where it is already inside the
 * prices rather than added on top — a cashier reading "Tax 10%" next to an
 * unchanged total would otherwise think it was forgotten.
 *
 * Rows only appear when they apply (a store with no service charge shows none),
 * so the common bill stays a three-line block and the footer stays short on a
 * cramped tablet.
 */
export function PosCartTotals({ taxLabel }: PosCartTotalsProps) {
  const { t, locale } = useI18n();
  // Cart amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const subtotal = usePosCart((s) => s.subtotal);
  const serviceCharge = usePosCart((s) => s.serviceCharge);
  const tax = usePosCart((s) => s.tax);
  const total = usePosCart((s) => s.total);
  const primaryDiscount = usePosCart((s) => s.primaryDiscountAmount);
  const pointsDiscount = usePosCart((s) => s.pointsDiscountAmount);
  const pointsRedeemed = usePosCart((s) => s.pointsRedeemed);
  const discountSource = usePosCart((s) => s.discountSource);
  const finance = usePosCart((s) => s.financeSettings);

  const discountLabel = discountSourceLabel(discountSource, (code) =>
    t("cashierCart.bill.couponLabel").replace("{code}", code)
  );
  const showService = finance.serviceChargeEnabled && finance.serviceChargeRate > 0;
  const showTax = finance.taxEnabled && finance.taxRate > 0;

  return (
    <div className="space-y-1 text-sm" data-testid="pos-cart-totals">
      {primaryDiscount > 0 && (
        <Row
          label={
            <>
              {t("cashierCart.bill.discount")}
              {discountLabel && <span className="text-muted-foreground"> ({discountLabel})</span>}
            </>
          }
          value={`-${formatPrice(primaryDiscount)}`}
          valueClassName="text-orange-600 dark:text-orange-400"
        />
      )}
      {pointsDiscount > 0 && (
        <Row
          label={
            <>
              {t("cashierCart.bill.pointsRedeemed")}
              <span className="text-muted-foreground">
                {" "}
                ({t("cashierCart.bill.pointsCount").replace("{count}", String(pointsRedeemed))})
              </span>
            </>
          }
          value={`-${formatPrice(pointsDiscount)}`}
          valueClassName="text-orange-600 dark:text-orange-400"
        />
      )}
      <Row label={t("cashierCart.bill.subTotal")} value={formatPrice(subtotal)} />
      {showService && (
        <Row
          label={t("cashierCart.bill.serviceCharge").replace(
            "{rate}",
            formatRatePercent(finance.serviceChargeRate, locale)
          )}
          value={formatPrice(serviceCharge)}
        />
      )}
      {showTax && (
        <Row
          label={t(finance.taxInclusive ? "cashierCart.bill.taxIncluded" : "cashierCart.bill.tax")
            .replace("{name}", taxLabel?.trim() || t("cashierCart.bill.taxDefaultName"))
            .replace("{rate}", formatRatePercent(finance.taxRate, locale))}
          value={formatPrice(tax)}
        />
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t pt-1.5 text-lg font-bold">
        <span>{t("cashierCart.bill.total")}</span>
        <span className="text-primary tabular-nums">{formatPrice(total)}</span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: React.ReactNode;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 break-words">{label}</span>
      <span className={`shrink-0 tabular-nums ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}
