"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Settings2, Send, Plus, CalendarOff, Printer } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { todayLocalISO } from "@/lib/utils/date-range";
import { addDaysToDateKey } from "@/lib/attendance/business-date";
import { MyScheduleList } from "./my-schedule-list";
import { ScheduleShiftBlocksDialog, type ScheduleShiftOption } from "./schedule-shift-blocks-dialog";
import { StaffScheduleCellDialog, type StaffScheduleEntry } from "./staff-schedule-cell-dialog";
import { ScheduleDayDetailDialog } from "./schedule-day-detail-dialog";
import type { StaffRole } from "@prisma/client";

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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayLocalISO()));
  const [blocksDialogOpen, setBlocksDialogOpen] = useState(false);
  const [cell, setCell] = useState<{ staffMemberId: string; dateKey: string } | null>(null);
  const [dayDetail, setDayDetail] = useState<string | null>(null);

  const today = todayLocalISO();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(weekStart, i)),
    [weekStart]
  );
  const weekEnd = weekDays[6];
  const isCurrentWeek = weekStart === mondayOf(today);

  const { data: blocksData } = useQuery({
    queryKey: ["schedule-shifts", storeId],
    queryFn: () =>
      apiClient.get<{ scheduleShifts: ScheduleShiftOption[] }>(`/stores/${storeId}/schedule-shifts`),
  });
  const scheduleShifts = blocksData?.scheduleShifts ?? [];

  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ["staff-schedules", storeId, weekStart],
    queryFn: () =>
      apiClient.get<{ schedules: ScheduleRow[] }>(`/stores/${storeId}/staff-schedules`, {
        from: weekStart,
        to: weekEnd,
      }),
    enabled: canManage,
  });

  const entriesFor = (staffMemberId: string, dateKey: string) =>
    (schedulesData?.schedules ?? []).filter(
      (s) => s.staffMember.id === staffMemberId && s.date.slice(0, 10) === dateKey
    );

  const entriesForDay = (dateKey: string) =>
    (schedulesData?.schedules ?? []).filter((s) => s.date.slice(0, 10) === dateKey);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["staff-schedules", storeId] });

  const openPrintView = () => {
    window.open(
      `/store/${storeId}/schedule/print?from=${weekStart}&to=${weekEnd}`,
      "_blank"
    );
  };

  const handlePublish = async () => {
    try {
      const res = await apiClient.post<{ publishedCount: number }>(
        `/stores/${storeId}/staff-schedules/publish`,
        { from: weekStart, to: weekEnd }
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
          <Button size="sm" variant="outline" onClick={openPrintView}>
            <Printer className="mr-2 h-4 w-4" />
            {t("pages.schedulePrint")}
          </Button>
          <Button size="sm" onClick={handlePublish}>
            <Send className="mr-2 h-4 w-4" />
            {t("pages.schedulePublishWeek")}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => setWeekStart((w) => addDaysToDateKey(w, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {weekStart} – {weekEnd}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => setWeekStart((w) => addDaysToDateKey(w, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={isCurrentWeek ? "secondary" : "outline"}
          className="h-8"
          disabled={isCurrentWeek}
          onClick={() => setWeekStart(mondayOf(today))}
        >
          {t("pages.scheduleToday")}
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-muted-foreground w-32 border-b p-2 text-left">
                {t("pages.staff") ?? "Staff"}
              </th>
              {weekDays.map((day) => (
                <th key={day} className="text-muted-foreground border-b p-2 text-left font-medium">
                  <button
                    type="button"
                    className={`hover:text-foreground hover:underline ${day === today ? "text-primary font-semibold" : ""}`}
                    onClick={() => setDayDetail(day)}
                  >
                    {day.slice(5)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="p-2 align-top font-medium">{member.name}</td>
                {weekDays.map((day) => {
                  const entries = entriesFor(member.id, day);
                  return (
                    <td
                      key={day}
                      className="hover:bg-muted/40 min-w-[100px] cursor-pointer p-2 align-top"
                      onClick={() =>
                        entries.length === 0 &&
                        setCell({ staffMemberId: member.id, dateKey: day })
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
                        {entries.length === 0 && (
                          <Plus className="text-muted-foreground/30 h-4 w-4" />
                        )}
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

      <ScheduleShiftBlocksDialog
        open={blocksDialogOpen}
        onOpenChange={setBlocksDialogOpen}
        storeId={storeId}
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
