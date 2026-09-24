"use client";

import { useMemo } from "react";
import { CalendarOff, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import type { StaffRole } from "@prisma/client";
import type { StaffScheduleEntry } from "./staff-schedule-cell-dialog";

/** One roster row as `GET /stores/:id/staff-schedules` returns it. */
export type ScheduleWeekGridEntry = StaffScheduleEntry & {
  staffMember: { id: string; name: string };
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
};

export interface ScheduleWeekGridStaff {
  id: string;
  name: string;
  role: StaffRole;
}

interface ScheduleWeekGridProps {
  /** YYYY-MM-DD, one column each. */
  days: string[];
  /** One row each, sorted here by role then name. */
  staff: ScheduleWeekGridStaff[];
  entries: ScheduleWeekGridEntry[];
  /** YYYY-MM-DD — that column's header is highlighted. */
  today: string;
  /** Draft/Published badges on the chips. */
  showStatus: boolean;
  /** Which entries to show (Back Office block filter). Defaults to all of them. */
  matches?: (entry: ScheduleWeekGridEntry) => boolean;
  onDayClick?: (dateKey: string) => void;
  onEntryClick?: (staffMemberId: string, dateKey: string, entryId: string) => void;
  onAddClick?: (staffMemberId: string, dateKey: string) => void;
}

const ROLE_ORDER: StaffRole[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];

const matchesAll = () => true;

const cellKey = (staffMemberId: string, dateKey: string) => `${staffMemberId}|${dateKey}`;

/**
 * The staff × day roster grid. With `onEntryClick`/`onAddClick` it is the Back
 * Office editor (chips open the entry, "+" adds one); without them it is a
 * read-only view — plain chips, no add cells.
 */
export function ScheduleWeekGrid({
  days,
  staff,
  entries,
  today,
  showStatus,
  matches = matchesAll,
  onDayClick,
  onEntryClick,
  onAddClick,
}: ScheduleWeekGridProps) {
  const { t, intlLocale } = useI18n();
  // Day keys are formatted as UTC midnight, so the weekday must be read in UTC
  // too — in the viewer's zone a viewer west of UTC gets the previous day.
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" }),
    [intlLocale]
  );
  const interactive = onEntryClick != null || onAddClick != null;
  // The sticky name column needs an opaque fill matching the surface it sits
  // on, or the day cells show through it when the table scrolls sideways.
  // Back Office renders on PageShell's card panel; POS Mode has no panel, so
  // the page background is the surface there.
  const stickyCell = `sticky left-0 z-10 ${interactive ? "bg-card" : "bg-background"}`;

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((a, b) => {
        const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
        return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name);
      }),
    [staff]
  );

  // Grouped once instead of scanning every entry for every cell; the API's
  // order is kept within a cell.
  const entriesByCell = useMemo(() => {
    const map = new Map<string, ScheduleWeekGridEntry[]>();
    for (const entry of entries) {
      const key = cellKey(entry.staffMember.id, entry.date.slice(0, 10));
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries]);

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table
        className="w-full border-collapse text-sm"
        style={{
          minWidth: interactive ? Math.max(840, 140 + days.length * 100) : 120 + days.length * 88,
        }}
      >
        <thead>
          <tr>
            <th
              className={`text-muted-foreground ${stickyCell} border-b p-2 text-left ${interactive ? "w-32" : "w-[120px]"}`}
            >
              {t("pages.staff") ?? "Staff"}
            </th>
            {days.map((day) => {
              const label = (
                <>
                  <span className="text-[10px] tracking-wide uppercase">
                    {weekdayFormatter.format(new Date(`${day}T00:00:00Z`))}
                  </span>
                  <span>{day.slice(5)}</span>
                </>
              );
              const highlight = day === today ? "text-primary font-semibold" : "";
              return (
                <th key={day} className="text-muted-foreground border-b p-2 text-left font-medium">
                  {onDayClick ? (
                    <button
                      type="button"
                      className={`hover:text-foreground flex min-h-10 flex-col hover:underline ${highlight}`}
                      onClick={() => onDayClick(day)}
                    >
                      {label}
                    </button>
                  ) : (
                    <div className={`flex min-h-10 flex-col ${highlight}`}>{label}</div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedStaff.map((member) => (
            <tr key={member.id} className="border-b last:border-0">
              <td className={`${stickyCell} p-2 align-top font-medium`}>{member.name}</td>
              {days.map((day) => {
                const allEntries = entriesByCell.get(cellKey(member.id, day)) ?? [];
                const cellEntries = allEntries.filter(matches);
                // A cell can look empty under an active block filter while
                // it actually holds a hidden, non-matching entry — shown as
                // a dot so "add" here reads as "clear the filter to see
                // what's already there" rather than a true empty slot.
                const hasHiddenEntry = cellEntries.length === 0 && allEntries.length > 0;
                return (
                  <td
                    key={day}
                    className={`p-2 align-top ${interactive ? "hover:bg-muted/40 min-w-[100px]" : "min-w-[88px]"}`}
                  >
                    <div className="flex flex-col gap-1">
                      {cellEntries.map((entry) => {
                        const chipClass =
                          "flex flex-col items-start rounded-md border px-2 py-1 text-left text-xs";
                        const chipStyle = {
                          borderColor: entry.isDayOff
                            ? undefined
                            : (entry.scheduleShift?.color ?? undefined),
                          backgroundColor: entry.isDayOff
                            ? undefined
                            : entry.scheduleShift?.color
                              ? `${entry.scheduleShift.color}1a`
                              : undefined,
                        };
                        const chipBody = (
                          <>
                            {entry.isDayOff ? (
                              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                                <CalendarOff className="h-3 w-3" />
                                {t("pages.scheduleDayOffOn")}
                              </span>
                            ) : (
                              <span className="font-medium">
                                {entry.scheduleShift
                                  ? entry.scheduleShift.name
                                  : `${entry.customStartTime}–${entry.customEndTime}`}
                              </span>
                            )}
                            {showStatus && !entry.isDayOff && (
                              <Badge
                                variant={entry.status === "PUBLISHED" ? "default" : "secondary"}
                                className="mt-0.5 px-1 py-0 text-[9px]"
                              >
                                {entry.status === "PUBLISHED"
                                  ? t("pages.schedulePublishedBadge")
                                  : t("pages.scheduleDraftBadge")}
                              </Badge>
                            )}
                          </>
                        );
                        return onEntryClick ? (
                          <button
                            key={entry.id}
                            type="button"
                            className={chipClass}
                            style={chipStyle}
                            onClick={() => onEntryClick(member.id, day, entry.id)}
                          >
                            {chipBody}
                          </button>
                        ) : (
                          <div
                            key={entry.id}
                            className={chipClass}
                            style={chipStyle}
                            data-testid="schedule-chip"
                          >
                            {chipBody}
                          </div>
                        );
                      })}
                      {onAddClick &&
                        (hasHiddenEntry ? (
                          <span
                            className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full"
                            data-testid="schedule-hidden-entry"
                          />
                        ) : (
                          <button
                            type="button"
                            title={t("pages.scheduleAddShift")}
                            aria-label={t("pages.scheduleAddShift")}
                            className="text-muted-foreground/50 hover:text-foreground hover:border-foreground/40 flex h-8 w-full items-center justify-center rounded-md border border-dashed"
                            onClick={() => onAddClick(member.id, day)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
