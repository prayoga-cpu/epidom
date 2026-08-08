"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangeField } from "@/components/ui/date-range-field";
import { ChevronLeft, ChevronRight, Settings2, Send, Plus, CalendarOff, Printer, Layers } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { todayLocalISO, parseLocalISO } from "@/lib/utils/date-range";
import { addDaysToDateKey } from "@/lib/attendance/business-date";
import { MyScheduleList } from "./my-schedule-list";
import { ScheduleShiftBlocksDialog, type ScheduleShiftOption } from "./schedule-shift-blocks-dialog";
import { StaffScheduleCellDialog, type StaffScheduleEntry } from "./staff-schedule-cell-dialog";
import { ScheduleDayDetailDialog } from "./schedule-day-detail-dialog";
import { ScheduleGridFilters } from "./schedule-grid-filters";
import { ApplyShiftTemplateDialog } from "./apply-shift-template-dialog";
import { ScheduleLog } from "./schedule-log";
import type { StaffRole } from "@prisma/client";

// The grid must always cover at least a full week — shorter custom ranges
// would leave the Draft/Publish-per-range workflow covering less than a
// normal roster cycle.
const MIN_RANGE_DAYS = 7;

const ROLE_ORDER: StaffRole[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

interface ScheduleRow extends StaffScheduleEntry {
  staffMember: { id: string; name: string };
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
}

interface ScheduleClientProps {
  storeId: string;
  staff: StaffOption[];
  canManage: boolean;
  viewerStaffMemberId: string | null;
}

function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // days since Monday
  return addDaysToDateKey(dateKey, -offset);
}

export function ScheduleClient({ storeId, staff, canManage, viewerStaffMemberId }: ScheduleClientProps) {
  const { t, intlLocale, dateLocale } = useI18n();
  const queryClient = useQueryClient();
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short" }),
    [intlLocale]
  );
  const [rangeFrom, setRangeFrom] = useState(() => mondayOf(todayLocalISO()));
  const [rangeTo, setRangeTo] = useState(() => addDaysToDateKey(mondayOf(todayLocalISO()), 6));
  const [blocksDialogOpen, setBlocksDialogOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [cell, setCell] = useState<{ staffMemberId: string; dateKey: string } | null>(null);
  const [dayDetail, setDayDetail] = useState<string | null>(null);
  // Persists across range navigation on purpose — a manager filtering to one
  // block or staff member is usually paging through several ranges with that
  // same lens, so resetting it on prev/next/pick would be a papercut.
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [blockFilter, setBlockFilter] = useState<string[]>([]);

  const today = todayLocalISO();

  // Exactly the days the manager chose — no longer forced back to a fixed
  // Mon-Sun week, though the picker itself enforces a MIN_RANGE_DAYS floor.
  const rangeDays = useMemo(() => {
    const days: string[] = [];
    for (let cursor = rangeFrom; cursor <= rangeTo; cursor = addDaysToDateKey(cursor, 1)) {
      days.push(cursor);
    }
    return days;
  }, [rangeFrom, rangeTo]);
  const isDefaultRange = rangeFrom === mondayOf(today) && rangeTo === addDaysToDateKey(mondayOf(today), 6);

  const shiftRange = (days: number) => {
    setRangeFrom(addDaysToDateKey(rangeFrom, days));
    setRangeTo(addDaysToDateKey(rangeTo, days));
  };

  const resetToDefaultRange = () => {
    const start = mondayOf(today);
    setRangeFrom(start);
    setRangeTo(addDaysToDateKey(start, 6));
  };

  const { data: blocksData } = useQuery({
    queryKey: ["schedule-shifts", storeId],
    queryFn: () =>
      apiClient.get<{ scheduleShifts: ScheduleShiftOption[] }>(`/stores/${storeId}/schedule-shifts`),
  });
  const scheduleShifts = blocksData?.scheduleShifts ?? [];

  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ["staff-schedules", storeId, rangeFrom, rangeTo],
    queryFn: () =>
      apiClient.get<{ schedules: ScheduleRow[] }>(`/stores/${storeId}/staff-schedules`, {
        from: rangeFrom,
        to: rangeTo,
      }),
    enabled: canManage,
  });

  const rangeSchedules = schedulesData?.schedules ?? [];
  const isRangePublished =
    rangeSchedules.length > 0 && rangeSchedules.every((s) => s.status === "PUBLISHED");

  // Day-off entries stay visible under an active block filter — "off" is
  // informative context (distinguishes approved leave from an unstaffed
  // gap), not noise to filter out.
  const matchesBlockFilter = (s: ScheduleRow) =>
    blockFilter.length === 0 ||
    s.isDayOff ||
    (s.scheduleShiftId != null && blockFilter.includes(s.scheduleShiftId));

  const allEntriesFor = (staffMemberId: string, dateKey: string) =>
    (schedulesData?.schedules ?? []).filter(
      (s) => s.staffMember.id === staffMemberId && s.date.slice(0, 10) === dateKey
    );

  const entriesFor = (staffMemberId: string, dateKey: string) =>
    allEntriesFor(staffMemberId, dateKey).filter(matchesBlockFilter);

  const entriesForDay = (dateKey: string) =>
    (schedulesData?.schedules ?? []).filter((s) => s.date.slice(0, 10) === dateKey && matchesBlockFilter(s));

  const visibleStaff = useMemo(() => {
    const base = staffFilter.length === 0 ? staff : staff.filter((s) => staffFilter.includes(s.id));
    return [...base].sort((a, b) => {
      const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name);
    });
  }, [staff, staffFilter]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["staff-schedules", storeId] });

  const openPrintView = () => {
    window.open(`/store/${storeId}/schedule/print?from=${rangeFrom}&to=${rangeTo}`, "_blank");
  };

  const handlePublish = async () => {
    try {
      const res = await apiClient.post<{ publishedCount: number }>(
        `/stores/${storeId}/staff-schedules/publish`,
        { from: rangeFrom, to: rangeTo }
      );
      toast.success(t("pages.schedulePublishConfirm").replace("{count}", String(res.publishedCount)));
      invalidate();
      // Publishing a roster is the moment it's meant to go up physically (break
      // room, etc.) — open the printable version right away instead of making
      // the manager hunt for a separate print action afterward.
      openPrintView();
    } catch {
      toast.error(t("common.error"));
    }
  };

  // One button, one slot: while the visible range still has a draft entry it
  // publishes; once every entry is published there's nothing left to
  // publish, so the same slot becomes the PDF export instead of going inert.
  const handlePublishOrExport = () => {
    if (isRangePublished) {
      openPrintView();
      return;
    }
    handlePublish();
  };

  if (!canManage) {
    return viewerStaffMemberId ? (
      <MyScheduleList storeId={storeId} staffMemberId={viewerStaffMemberId} />
    ) : null;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("pages.scheduleTitle")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setBlocksDialogOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            {t("pages.scheduleManageBlocks")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setApplyTemplateOpen(true)}>
            <Layers className="mr-2 h-4 w-4" />
            {t("pages.scheduleApplyTemplate")}
          </Button>
          <Button
            size="sm"
            variant={isRangePublished ? "secondary" : "default"}
            onClick={handlePublishOrExport}
          >
            {isRangePublished ? (
              <Printer className="mr-2 h-4 w-4" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isRangePublished ? t("pages.schedulePublished") : t("pages.schedulePublishWeek")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => shiftRange(-rangeDays.length)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(parseLocalISO(rangeFrom), "d MMM yyyy", { locale: dateLocale })} –{" "}
          {format(parseLocalISO(rangeTo), "d MMM yyyy", { locale: dateLocale })}
        </span>
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => shiftRange(rangeDays.length)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isDefaultRange ? "secondary" : "outline"}
          className="h-8"
          disabled={isDefaultRange}
          onClick={resetToDefaultRange}
        >
          {t("pages.scheduleToday")}
        </Button>
        <DateRangeField
          from={rangeFrom}
          to={rangeTo}
          onChange={(nextFrom, nextTo) => {
            setRangeFrom(nextFrom);
            setRangeTo(nextTo);
          }}
          minDays={MIN_RANGE_DAYS}
          presets={[]}
          className="w-auto"
        />
      </div>

      <ScheduleGridFilters
        staff={staff}
        scheduleShifts={scheduleShifts}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        blockFilter={blockFilter}
        onBlockFilterChange={setBlockFilter}
      />

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: Math.max(840, 140 + rangeDays.length * 100) }}
        >
          <thead>
            <tr>
              <th className="text-muted-foreground w-32 border-b p-2 text-left">
                {t("pages.staff") ?? "Staff"}
              </th>
              {rangeDays.map((day) => (
                <th key={day} className="text-muted-foreground border-b p-2 text-left font-medium">
                  <button
                    type="button"
                    className={`hover:text-foreground flex flex-col hover:underline ${day === today ? "text-primary font-semibold" : ""}`}
                    onClick={() => setDayDetail(day)}
                  >
                    <span className="text-[10px] tracking-wide uppercase">
                      {weekdayFormatter.format(new Date(`${day}T00:00:00Z`))}
                    </span>
                    <span>{day.slice(5)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="p-2 align-top font-medium">{member.name}</td>
                {rangeDays.map((day) => {
                  const entries = entriesFor(member.id, day);
                  // Gate on the *unfiltered* entry count, not the filtered
                  // one — a cell can look empty under an active block filter
                  // while it actually already holds a hidden, non-matching
                  // entry. Clicking it must not silently create a duplicate;
                  // clear the filter to edit that entry instead.
                  const isTrulyEmpty = allEntriesFor(member.id, day).length === 0;
                  return (
                    <td
                      key={day}
                      className="hover:bg-muted/40 min-w-[100px] cursor-pointer p-2 align-top"
                      onClick={() =>
                        isTrulyEmpty && setCell({ staffMemberId: member.id, dateKey: day })
                      }
                    >
                      <div className="flex flex-col gap-1">
                        {entries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className="flex flex-col items-start rounded-md border px-2 py-1 text-left text-xs"
                            style={{
                              borderColor: entry.isDayOff
                                ? undefined
                                : (entry.scheduleShift?.color ?? undefined),
                              backgroundColor: entry.isDayOff
                                ? undefined
                                : entry.scheduleShift?.color
                                  ? `${entry.scheduleShift.color}1a`
                                  : undefined,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCell({ staffMemberId: member.id, dateKey: day });
                            }}
                          >
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
                            {!entry.isDayOff && (
                              <Badge
                                variant={entry.status === "PUBLISHED" ? "default" : "secondary"}
                                className="mt-0.5 px-1 py-0 text-[9px]"
                              >
                                {entry.status === "PUBLISHED"
                                  ? t("pages.schedulePublishedBadge")
                                  : t("pages.scheduleDraftBadge")}
                              </Badge>
                            )}
                          </button>
                        ))}
                        {entries.length === 0 &&
                          (isTrulyEmpty ? (
                            <Plus className="text-muted-foreground/30 h-4 w-4" />
                          ) : (
                            <span className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full" />
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
      {isLoading && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}

      <div className="border-t pt-4">
        <ScheduleLog storeId={storeId} staff={staff} />
      </div>

      <ScheduleShiftBlocksDialog
        open={blocksDialogOpen}
        onOpenChange={setBlocksDialogOpen}
        storeId={storeId}
      />

      <ApplyShiftTemplateDialog
        open={applyTemplateOpen}
        onOpenChange={setApplyTemplateOpen}
        storeId={storeId}
        staff={staff}
        scheduleShifts={scheduleShifts}
        weekDays={rangeDays}
        weekdayFormatter={weekdayFormatter}
        existingSchedules={rangeSchedules}
        onApplied={invalidate}
      />

      {cell && (
        <StaffScheduleCellDialog
          open={!!cell}
          onOpenChange={(next) => !next && setCell(null)}
          storeId={storeId}
          staffMemberId={cell.staffMemberId}
          dateKey={cell.dateKey}
          scheduleShifts={scheduleShifts}
          existing={entriesFor(cell.staffMemberId, cell.dateKey)[0] ?? null}
          onSaved={invalidate}
        />
      )}

      {dayDetail && (
        <ScheduleDayDetailDialog
          open={!!dayDetail}
          onOpenChange={(next) => !next && setDayDetail(null)}
          dateKey={dayDetail}
          entries={entriesForDay(dayDetail)}
        />
      )}
    </div>
  );
}
