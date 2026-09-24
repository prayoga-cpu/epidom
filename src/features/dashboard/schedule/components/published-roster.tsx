"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import type { StaffRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient } from "@/lib/api/client";
import { parseLocalISO } from "@/lib/utils/date-range";
import { addDaysToDateKey, mondayOfDateKey } from "@/lib/attendance/business-date";
import { useTodayKey } from "@/features/pos/hooks/use-today-key";
import { ScheduleWeekGrid, type ScheduleWeekGridEntry } from "./schedule-week-grid";
import { ScheduleImageCards } from "./schedule-image-cards";
import { ScheduleDayDetailDialog } from "./schedule-day-detail-dialog";
import type { ScheduleImageRow } from "./schedule-image-panel";

interface PublishedRosterProps {
  storeId: string;
  /** Active staff, from the server. Rows are drawn only for these. */
  staff: { id: string; name: string; role: StaffRole }[];
  /**
   * Who is looking (the persona id). Part of the roster's query key, so a
   * persona switch on a shared device never reads the previous one's cache.
   */
  viewerKey: string;
  /** Where "Edit in Back Office" goes. Left out, there is no such link. */
  backOfficeHref?: string;
}

// Human-paced data (a manager publishing now and then), on a device that may sit
// on this tab all day. Through the query provider's `meta` polling, so it pauses
// while the tab is hidden or offline.
const POLL_MS = 60 * 1000;

/**
 * The whole team's PUBLISHED roster for one Mon–Sun week, read only: POS Mode's
 * Team Schedule tab. The same grid as Back Office /schedule, minus everything
 * that edits it — no add cells, no chip dialogs, no Draft/Published badges —
 * plus the week's roster images. Drafts never show: the request asks for
 * PUBLISHED rows only and anything else that slips through is dropped here too.
 *
 * Only staff with something published this week get a row, and only active
 * staff (an entry for someone no longer in `staff` is dropped).
 */
export function PublishedRoster({
  storeId,
  staff,
  viewerKey,
  backOfficeHref,
}: PublishedRosterProps) {
  const { t, dateLocale } = useI18n();
  // Kept current: ticks over at local midnight and when the tab wakes, so a
  // device left on this tab moves into the new week on Monday by itself.
  const today = useTodayKey();
  const currentWeek = mondayOfDateKey(today);
  // null = follow the current week (and roll with it). A week the viewer moved
  // to stays put when the calendar turns over.
  const [pinnedWeek, setPinnedWeek] = useState<string | null>(null);
  const weekFrom = pinnedWeek ?? currentWeek;
  const weekTo = addDaysToDateKey(weekFrom, 6);
  const isCurrentWeek = weekFrom === currentWeek;
  const goToWeek = (from: string) => setPinnedWeek(from === currentWeek ? null : from);
  const [dayDetail, setDayDetail] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(weekFrom, i)),
    [weekFrom]
  );

  const roster = useQuery({
    queryKey: ["staff-schedules", storeId, "published", viewerKey, weekFrom, weekTo],
    queryFn: () =>
      apiClient.get<{ schedules: ScheduleWeekGridEntry[] }>(`/stores/${storeId}/staff-schedules`, {
        from: weekFrom,
        to: weekTo,
        status: "PUBLISHED",
      }),
    meta: { refetchInterval: POLL_MS },
  });

  // The same key as Back Office's ScheduleImagePanel, so one cache serves both
  // and its publish/remove invalidation reaches this view.
  const imagesQuery = useQuery({
    queryKey: ["schedule-images", storeId, weekFrom, weekTo],
    queryFn: () =>
      apiClient.get<{ images: ScheduleImageRow[] }>(`/stores/${storeId}/schedule-images`, {
        from: weekFrom,
        to: weekTo,
      }),
    meta: { refetchInterval: POLL_MS },
  });
  const images = imagesQuery.data?.images ?? [];

  const activeIds = useMemo(() => new Set(staff.map((s) => s.id)), [staff]);
  const entries = useMemo(
    () =>
      (roster.data?.schedules ?? []).filter(
        (s) => s.status === "PUBLISHED" && activeIds.has(s.staffMember.id)
      ),
    [roster.data, activeIds]
  );
  const rows = useMemo(() => {
    const scheduled = new Set(entries.map((e) => e.staffMember.id));
    return staff.filter((s) => scheduled.has(s.id));
  }, [staff, entries]);

  const entriesForDay = (dateKey: string) => entries.filter((e) => e.date.slice(0, 10) === dateKey);

  // A read that hasn't answered, or that failed with nothing cached, must never
  // pass for "nothing published". Pending (no data yet), not isLoading: isLoading
  // is false while a query is paused offline or the persisted cache is still
  // being restored, and either would otherwise fall through to the empty state.
  const rosterFailed = roster.isError && !roster.data;
  const imagesFailed = imagesQuery.isError && !imagesQuery.data;
  const pending = roster.isPending || imagesQuery.isPending;
  const offline =
    pending && (roster.fetchStatus === "paused" || imagesQuery.fetchStatus === "paused");

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10"
          aria-label={t("pos.operational.rosterPrevWeek")}
          onClick={() => goToWeek(addDaysToDateKey(weekFrom, -7))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {format(parseLocalISO(weekFrom), "d MMM yyyy", { locale: dateLocale })} –{" "}
          {format(parseLocalISO(weekTo), "d MMM yyyy", { locale: dateLocale })}
        </span>
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10"
          aria-label={t("pos.operational.rosterNextWeek")}
          onClick={() => goToWeek(addDaysToDateKey(weekFrom, 7))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant={isCurrentWeek ? "secondary" : "outline"}
          className="h-10"
          disabled={isCurrentWeek}
          onClick={() => setPinnedWeek(null)}
        >
          {t("pages.scheduleToday")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("pos.operational.rosterReadOnly")}</p>
        {backOfficeHref && (
          <Button asChild size="sm" variant="outline" className="h-10">
            <Link href={backOfficeHref}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              {t("pos.operational.rosterEditInBackOffice")}
            </Link>
          </Button>
        )}
      </div>

      {rosterFailed ? (
        <p className="text-destructive text-sm">{t("common.error")}</p>
      ) : pending ? (
        <p className="text-muted-foreground text-sm">
          {offline ? t("common.pwa.connectionOffline") : t("common.loading")}
        </p>
      ) : (
        <>
          {/* The roster still shows when only the images failed — but say so,
              rather than leave out a picture the manager may have published. */}
          {imagesFailed ? (
            <p className="text-destructive text-sm">{t("pages.scheduleImageLoadFailed")}</p>
          ) : (
            <ScheduleImageCards images={images} />
          )}
          {rows.length > 0 ? (
            <ScheduleWeekGrid
              days={days}
              staff={rows}
              entries={entries}
              today={today}
              showStatus={false}
              onDayClick={setDayDetail}
            />
          ) : (
            // An image alone is a published schedule — only "empty" with neither.
            !imagesFailed &&
            images.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("pos.operational.rosterEmpty")}</p>
            )
          )}
        </>
      )}

      {dayDetail && (
        <ScheduleDayDetailDialog
          open={!!dayDetail}
          onOpenChange={(next) => !next && setDayDetail(null)}
          dateKey={dayDetail}
          entries={entriesForDay(dayDetail)}
          hideManagerDetails
        />
      )}
    </div>
  );
}
