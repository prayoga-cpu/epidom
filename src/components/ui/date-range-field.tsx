"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  toLocalISO,
  parseLocalISO,
  describeDateRange,
  resolveDateRangePreset,
  DATE_RANGE_PRESETS,
  type DateRangePreset,
} from "@/lib/utils/date-range";

interface DateRangeFieldProps {
  id?: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Quick-pick shortcuts shown above the calendar. Pass `[]` to hide (e.g. when an
   * outer preset selector already covers this, as in the POS order history filters). */
  presets?: readonly DateRangePreset[];
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Single integrated calendar for picking a date range — a trigger button
 * showing the current range/preset that opens a popover with quick presets
 * and one month of range-highlighted days. Replaces the old pattern of two
 * separate From/To date inputs plus a standalone preset dropdown.
 */
export function DateRangeField({
  id,
  from,
  to,
  onChange,
  presets = DATE_RANGE_PRESETS,
  className,
  align = "start",
}: DateRangeFieldProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;
    setDraft(from ? { from: parseLocalISO(from), to: to ? parseLocalISO(to) : undefined } : undefined);
  }, [open, from, to]);

  const activePreset = from && to ? describeDateRange(from, to) : "custom";

  const label = React.useMemo(() => {
    if (activePreset !== "custom") {
      return t(`common.datePicker.presets.${activePreset}`);
    }
    if (!from) return t("common.datePicker.pickDateRange");
    const fromDate = parseLocalISO(from);
    if (!to || to === from) return format(fromDate, "d MMM yyyy");
    return `${format(fromDate, "d MMM yyyy")} - ${format(parseLocalISO(to), "d MMM yyyy")}`;
  }, [activePreset, from, to, t]);

  const applyPreset = (preset: DateRangePreset) => {
    const range = resolveDateRangePreset(preset);
    onChange(range.from, range.to);
  };

  const handleSelect = (range: DateRange | undefined) => {
    setDraft(range);
    if (range?.from && range?.to) {
      onChange(toLocalISO(range.from), toLocalISO(range.to));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal sm:w-64",
            !from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[17rem] p-0" align={align}>
        {presets.length > 0 && (
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto border-b p-3">
            {presets.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={activePreset === preset ? "default" : "outline"}
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={() => applyPreset(preset)}
              >
                {t(`common.datePicker.presets.${preset}`)}
              </Button>
            ))}
          </div>
        )}
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={draft?.from ?? (from ? parseLocalISO(from) : undefined)}
          selected={draft}
          onSelect={handleSelect}
          numberOfMonths={1}
          className="mx-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
