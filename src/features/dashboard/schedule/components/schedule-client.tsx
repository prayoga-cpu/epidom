"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeField } from "@/components/ui/date-range-field";
import { ChevronLeft, ChevronRight, Settings2, Send, Printer, Layers } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { todayLocalISO, parseLocalISO } from "@/lib/utils/date-range";
import { addDaysToDateKey, mondayOfDateKey } from "@/lib/attendance/business-date";
import { MyScheduleList } from "./my-schedule-list";
import { ScheduleShiftBlocksDialog, type ScheduleShiftOption } from "./schedule-shift-blocks-dialog";
import { StaffScheduleCellDialog } from "./staff-schedule-cell-dialog";
import { ScheduleDayDetailDialog } from "./schedule-day-detail-dialog";
import { ScheduleGridFilters } from "./schedule-grid-filters";
import { ApplyShiftTemplateDialog } from "./apply-shift-template-dialog";
import { ScheduleLog } from "./schedule-log";
import { ScheduleImagePanel } from "./schedule-image-panel";
import { ScheduleWeekGrid, type ScheduleWeekGridEntry } from "./schedule-week-grid";
import type { StaffRole } from "@prisma/client";

// How the roster is kept: named shift blocks in the grid, or a photo/screenshot of
// a schedule made elsewhere. Only which one the manager is LOOKING at — staff see
// whatever exists for their dates, so a store can use both.
type ScheduleView = "blocks" | "image";
const VIEW_STORAGE_KEY = "epidom-schedule-view";

// The grid must always cover at least a full week — shorter custom ranges
// would leave the Draft/Publish-per-range workflow covering less than a
// normal roster cycle.
const MIN_RANGE_DAYS = 7;

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

type ScheduleRow = ScheduleWeekGridEntry;

interface ScheduleClientProps {
  storeId: string;
  staff: StaffOption[];
  canManage: boolean;
  viewerStaffMemberId: string | null;
}

export function ScheduleClient({ storeId, staff, canManage, viewerStaffMemberId }: ScheduleClientProps) {
  const { t, intlLocale, dateLocale } = useI18n();
  const queryClient = useQueryClient();
  // Day keys are formatted as UTC midnight, so the weekday must be read in UTC
  // too — in the viewer's zone a viewer west of UTC gets the previous day.
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" }),
    [intlLocale]
  );
  const [rangeFrom, setRangeFrom] = useState(() => mondayOfDateKey(todayLocalISO()));
  const [rangeTo, setRangeTo] = useState(() =>
    addDaysToDateKey(mondayOfDateKey(todayLocalISO()), 6)
  );
  const [blocksDialogOpen, setBlocksDialogOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  // `entryId` absent means "add a new shift for this staff/day" — a day can
  // now hold several StaffSchedule rows (e.g. a split 8h-10h / 14h-16h shift),
  // so a cell click has to say which one it means, not just which cell.
  const [cell, setCell] = useState<{ staffMemberId: string; dateKey: string; entryId?: string } | null>(
    null
  );
  const [dayDetail, setDayDetail] = useState<string | null>(null);
  // Persists across range navigation on purpose — a manager filtering to one
  // block or staff member is usually paging through several ranges with that
  // same lens, so resetting it on prev/next/pick would be a papercut.
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [blockFilter, setBlockFilter] = useState<string[]>([]);

  // Remembered per device so a manager who keeps the roster as an image doesn't
  // land on the empty grid every visit. Read after mount (not in the initial
  // state) so server and client render the same first frame; storage can be
  // blocked or empty, in which case it is just "blocks".
  const [view, setView] = useState<ScheduleView>("blocks");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_STORAGE_KEY) === "image") setView("image");
    } catch {
      // ignore
    }
  }, []);
  const changeView = (next: ScheduleView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

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
  const isDefaultRange =
    rangeFrom === mondayOfDateKey(today) && rangeTo === addDaysToDateKey(mondayOfDateKey(today), 6);

  const shiftRange = (days: number) => {
    setRangeFrom(addDaysToDateKey(rangeFrom, days));
    setRangeTo(addDaysToDateKey(rangeTo, days));
  };

  const resetToDefaultRange = () => {
    const start = mondayOfDateKey(today);
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

  const entriesForDay = (dateKey: string) =>
    (schedulesData?.schedules ?? []).filter((s) => s.date.slice(0, 10) === dateKey && matchesBlockFilter(s));

  // Row order (role, then name) is the grid's job.
  const visibleStaff = useMemo(
    () => (staffFilter.length === 0 ? staff : staff.filter((s) => staffFilter.includes(s.id))),
    [staff, staffFilter]
  );

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
        {view === "blocks" && (
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
        )}
      </div>

      {/* Two ways to publish a roster. Same date range either way (below). */}
      <Tabs value={view} onValueChange={(v) => changeView(v as ScheduleView)}>
        <TabsList>
          <TabsTrigger value="blocks">{t("pages.scheduleViewBlocks")}</TabsTrigger>
          <TabsTrigger value="image">{t("pages.scheduleViewImage")}</TabsTrigger>
        </TabsList>
      </Tabs>

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

      {view === "image" ? (
        <ScheduleImagePanel
          key={`${rangeFrom}_${rangeTo}`}
          storeId={storeId}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
        />
      ) : (
      <>
      <ScheduleGridFilters
        staff={staff}
        scheduleShifts={scheduleShifts}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        blockFilter={blockFilter}
        onBlockFilterChange={setBlockFilter}
      />

      <ScheduleWeekGrid
        days={rangeDays}
        staff={visibleStaff}
        entries={rangeSchedules}
        today={today}
        showStatus
        matches={matchesBlockFilter}
        onDayClick={setDayDetail}
        onEntryClick={(staffMemberId, dateKey, entryId) =>
          setCell({ staffMemberId, dateKey, entryId })
        }
        onAddClick={(staffMemberId, dateKey) => setCell({ staffMemberId, dateKey })}
      />
      {isLoading && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}
      </>
      )}

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
          existing={
            cell.entryId
              ? (allEntriesFor(cell.staffMemberId, cell.dateKey).find((e) => e.id === cell.entryId) ??
                null)
              : null
          }
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
