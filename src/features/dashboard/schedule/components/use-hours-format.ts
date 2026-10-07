"use client";

import { useCallback, useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatDuration, formatSignedDuration, type DurationUnits } from "@/lib/attendance/format-duration";
import { formatCurrency } from "@/lib/utils/formatting";

/**
 * Locale-bound formatters for the hours and salary views: durations in the
 * locale's units ("1h 2m" / "1j 2m"), signed differences ("+1h 2m"), and
 * money as a LITERAL amount in the store's own currency — salary figures are
 * never IDR-converted, so this deliberately avoids useCurrency().formatPrice,
 * whose second argument is a currency to convert FROM.
 */
export function useHoursFormat() {
  const { t, intlLocale } = useI18n();
  const units = useMemo<DurationUnits>(
    () => ({
      hour: t("pages.attendanceDurationHourUnit"),
      minute: t("pages.attendanceDurationMinuteUnit"),
    }),
    [t]
  );

  const duration = useCallback((minutes: number) => formatDuration(minutes, units), [units]);
  const signedDuration = useCallback((minutes: number) => formatSignedDuration(minutes, units), [units]);
  const money = useCallback(
    (amount: number, currency: string) => formatCurrency(amount, currency, intlLocale),
    [intlLocale]
  );

  return { duration, signedDuration, money };
}

/** Tailwind text colour for a difference: over in green, under in red, on target muted. */
export function differenceTone(minutes: number): string {
  if (minutes > 0) return "text-emerald-700 dark:text-emerald-400";
  if (minutes < 0) return "text-destructive";
  return "text-muted-foreground";
}
