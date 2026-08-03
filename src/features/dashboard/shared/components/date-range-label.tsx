"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  describeDateRange,
  resolveDateRangePreset,
  DATE_RANGE_PRESETS,
  type DateRangeLabelKey,
} from "@/lib/utils/date-range";

interface DateRangeLabelProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

/**
 * Shows which preset the current from/to matches ("Today", "Last 7 Days",
 * ...) and doubles as a shortcut picker — selecting a different preset jumps
 * the from/to inputs straight to it, alongside manually editing the dates.
 */
export function DateRangeLabel({ from, to, onChange }: DateRangeLabelProps) {
  const { t } = useI18n();
  const current: DateRangeLabelKey = describeDateRange(from, to);

  return (
    // self-end: this sits in a `flex items-start gap-4` row next to
    // labeled From/To inputs (label line + h-9 input line) — without this
    // it inherits the row's default top alignment and floats up next to
    // the labels instead of lining up with the inputs themselves.
    <Select
      value={current}
      onValueChange={(value) => {
        if (value === "custom") return;
        const range = resolveDateRangePreset(value as (typeof DATE_RANGE_PRESETS)[number]);
        onChange(range.from, range.to);
      }}
    >
      <SelectTrigger className="h-9 w-[140px] shrink-0 self-end rounded-full px-3">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {DATE_RANGE_PRESETS.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {t(`common.datePicker.presets.${preset}`)}
          </SelectItem>
        ))}
        {current === "custom" && (
          <SelectItem value="custom">{t("common.datePicker.presets.custom")}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
