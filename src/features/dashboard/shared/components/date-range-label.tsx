"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import { describeDateRange } from "@/lib/utils/date-range";

/** Shows "Today" / "Last 7 Days" / etc. next to a from/to date-range picker when it matches a well-known preset. */
export function DateRangeLabel({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const key = describeDateRange(from, to);
  if (key === "custom") return null;

  return (
    <Badge variant="secondary" className="self-end">
      {t(`common.datePicker.presets.${key}`)}
    </Badge>
  );
}
