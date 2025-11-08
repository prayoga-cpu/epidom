"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDateRange, getLastNDays } from "@/lib/utils/filters";
import { useI18n } from "@/components/lang/i18n-provider";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "start",
}: DateRangePickerProps) {
  const { t } = useI18n();
  const [selectedPreset, setSelectedPreset] = React.useState<string>("custom");

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);

    if (preset === "custom") {
      return;
    }

    let range: { from: Date; to: Date };

    switch (preset) {
      case "today":
        range = getDateRange("today");
        break;
      case "7d":
        range = getLastNDays(7);
        break;
      case "30d":
        range = getLastNDays(30);
        break;
      case "90d":
        range = getLastNDays(90);
        break;
      case "year":
        range = getDateRange("year");
        break;
      default:
        return;
    }

    onChange(range);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y")} - {format(value.to, "LLL dd, y")}
                </>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>{t("common.datePicker.pickDateRange")}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="border-b p-3">
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.datePicker.selectPreset")} />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="today">{t("common.datePicker.presets.today")}</SelectItem>
                <SelectItem value="7d">{t("common.datePicker.presets.last7Days")}</SelectItem>
                <SelectItem value="30d">{t("common.datePicker.presets.last30Days")}</SelectItem>
                <SelectItem value="90d">{t("common.datePicker.presets.last90Days")}</SelectItem>
                <SelectItem value="year">{t("common.datePicker.presets.thisYear")}</SelectItem>
                <SelectItem value="custom">{t("common.datePicker.presets.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={(range) => {
              onChange(range);
              if (range?.from && range?.to) {
                setSelectedPreset("custom");
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}






