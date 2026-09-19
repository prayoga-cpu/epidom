"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { getCashPresets } from "../lib/cash-presets";

interface PosCashPresetsProps {
  /** What is owed — the first button pays exactly this. */
  total: number;
  /** ISO 4217 code; picks the denomination steps (see getCashPresets). */
  currency: string;
  /** The amount currently typed into "Amount tendered", to highlight a match. */
  value: number | undefined;
  onSelect: (amount: number) => void;
  /** Literal-currency formatter — the caller passes the two-arg form, so nothing here is IDR-converted. */
  formatPrice: (value: number) => string;
  className?: string;
}

/**
 * Quick-tender buttons under the cash field: exact, then the notes a customer
 * most plausibly hands over. Tapping one fills "Amount tendered", it never
 * submits — the cashier still confirms.
 *
 * iPad is the primary till, so every button is a 44px+ target (min-h-11) laid
 * out on a grid rather than flex-wrap, which keeps a five-button row from
 * leaving one orphan on its own line.
 */
export function PosCashPresets({
  total,
  currency,
  value,
  onSelect,
  formatPrice,
  className,
}: PosCashPresetsProps) {
  const { t } = useI18n();
  const presets = getCashPresets(total, currency);
  if (presets.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("cashierCheckout.cash.quickAmounts")}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
    >
      {presets.map((amount, index) => {
        const selected = value !== undefined && Math.abs(value - amount) < 0.005;
        const isExact = index === 0;
        return (
          <button
            key={amount}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(amount)}
            className={cn(
              "flex min-h-11 touch-manipulation flex-col items-center justify-center rounded-md border px-2 py-1.5 text-sm font-semibold tabular-nums transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:border-foreground/40"
            )}
          >
            {isExact && (
              <span
                className={cn(
                  "text-[10px] leading-none font-medium uppercase",
                  selected ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {t("cashierCheckout.cash.exact")}
              </span>
            )}
            <span>{formatPrice(amount)}</span>
          </button>
        );
      })}
    </div>
  );
}
