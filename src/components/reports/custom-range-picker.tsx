"use client";

import { useRouter } from "next/navigation";
import { DateRangeField } from "@/components/ui/date-range-field";
import { cn } from "@/lib/utils";
import type { CustomDays } from "@/lib/report-range";

/** `path?range=custom&from=…&to=…`, plus the other params the page keeps (its language filter…). */
export function customRangeHref(
  path: string,
  days: CustomDays,
  keep: Record<string, string> = {}
): string {
  const query = new URLSearchParams({ ...keep, range: "custom", from: days.from, to: days.to });
  return `${path}?${query.toString()}`;
}

/**
 * The "Custom" option at the end of a report's range tabs: the app's date
 * range calendar (DateRangeField, no presets since the tabs are the presets).
 * Picking both days opens the report for them, so the range stays in the URL
 * like the tabs' ranges do. Takes a path and params, not a function, so a
 * server component can render it.
 */
export function CustomRangePicker({
  value,
  path,
  keep,
  label,
  className,
}: {
  /** The days shown, when the report is on a custom range; null otherwise. */
  value: CustomDays | null;
  /** The report's page, e.g. "/admin/pixel". */
  path: string;
  /** Other query params to keep, e.g. { lang: "fr" }. */
  keep?: Record<string, string>;
  /** The button's text before any day is picked ("Custom"). */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const active = value !== null;
  return (
    <DateRangeField
      from={value?.from ?? ""}
      to={value?.to ?? ""}
      presets={[]}
      align="end"
      placeholder={label}
      // The report reloads on a change: wait for both days.
      commitOnSecondTap
      onChange={(from, to) => router.push(customRangeHref(path, { from, to }, keep))}
      className={cn(
        "h-auto min-h-9 w-auto shrink-0 rounded-md border-0 px-2.5 text-xs font-bold whitespace-nowrap shadow-none sm:w-auto [&_svg]:h-3.5 [&_svg]:w-3.5",
        active
          ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200"
          : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent",
        className
      )}
    />
  );
}
