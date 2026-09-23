"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarOff,
  LogIn,
  History as HistoryIcon,
  ImageOff,
  MapPin,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
} from "lucide-react";
import { DateRangeField } from "@/components/ui/date-range-field";
import { apiClient } from "@/lib/api/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { format } from "date-fns";
import { todayLocalISO, addDaysLocalISO, parseLocalISO } from "@/lib/utils/date-range";
import { ClockInOutDialog } from "@/features/dashboard/shared/clock-in-out-dialog";
import type { StaffScheduleEntry } from "./staff-schedule-cell-dialog";
import type { ScheduleImageRow } from "./schedule-image-panel";

interface MySchedule extends StaffScheduleEntry {
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
}

interface UnifiedLogRow {
  id: string;
  timestamp: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";
  selfieUrl: string | null;
  locationLabel: string | null;
  /** A cash movement's reason, or a till session's close-out notes. */
  notes: string | null;
  amount: number | null;
}

export function MyScheduleList({ storeId, staffMemberId }: { storeId: string; staffMemberId: string }) {
  const { t, formatDateTime, dateLocale } = useI18n();
  // History amounts (a till's float, a cash movement) are Shift/CashMovement-
  // derived and already literal in the store's own currency. The bare one-arg
  // formatPrice() defaults `fromCurrency` to IDR and would convert them,
  // re-scaling every amount for any non-IDR store — the same trap
  // operations-card.tsx guards against.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number) => formatPriceRaw(value, currency);

  const [clockDialogOpen, setClockDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-schedules", storeId, "mine", staffMemberId],
    queryFn: () =>
      apiClient.get<{ schedules: MySchedule[] }>(`/stores/${storeId}/staff-schedules`, {
        staffId: staffMemberId,
        from: todayLocalISO(),
      }),
  });
  const upcoming = (data?.schedules ?? []).filter((s) => s.date >= todayLocalISO());
  const today = todayLocalISO();

  // The manager's other way to publish a roster: a picture. The same for the whole
  // team (nothing per-person to filter), so it needs no staffId. `from: today` keeps
  // every image whose dates haven't fully passed. Key shares the ["schedule-images",
  // storeId] prefix so the manager publishing or removing one refreshes this.
  const { data: imageData } = useQuery({
    queryKey: ["schedule-images", storeId, "from", today],
    queryFn: () =>
      apiClient.get<{ images: ScheduleImageRow[] }>(`/stores/${storeId}/schedule-images`, {
        from: today,
      }),
  });
  const images = imageData?.images ?? [];

  // Defaults to the last 30 days rather than an unbounded "recent 20" — a
  // concrete range is what DateRangeField (and every other history/report
  // view in the app) is built around, and it's a more legible default than
  // "however many records happened to fit."
  const [historyFrom, setHistoryFrom] = useState(addDaysLocalISO(todayLocalISO(), -30));
  const [historyTo, setHistoryTo] = useState(todayLocalISO());
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["schedule-my-log", storeId, staffMemberId, historyFrom, historyTo],
    queryFn: () =>
      apiClient.get<{ records: UnifiedLogRow[] }>(`/stores/${storeId}/schedule/my-log`, {
        staffId: staffMemberId,
        // T00:00:00Z / T23:59:59Z: the API's from/to are full datetimes, not
        // bare dates — feeding it a bare date silently produces garbage.
        from: `${historyFrom}T00:00:00Z`,
        to: `${historyTo}T23:59:59Z`,
        take: "50",
      }),
  });
  // Server always returns newest-first; asc is a client-side reverse rather
  // than a second query shape, since the whole (already date-bounded, ≤50
  // row) result set is already in memory.
  const historyRecords = historySort === "asc"
    ? [...(historyData?.records ?? [])].reverse()
    : (historyData?.records ?? []);

  const typeLabel = (type: UnifiedLogRow["type"]) => {
    switch (type) {
      case "CLOCK_IN":
        return t("clockInOut.typeClockIn");
      case "CLOCK_OUT":
        return t("clockInOut.typeClockOut");
      case "ABSENCE":
        return t("clockInOut.typeAbsence");
      case "CASH_IN":
        return t("clockInOut.typeCashIn");
      case "CASH_OUT":
        return t("clockInOut.typeCashOut");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("pages.scheduleMyScheduleTitle")}</h1>
        {/* h-10 overrides size="sm"'s 32px: this is the cashier's primary
            control surface on an iPad, and AGENTS.md sets a 40px floor for
            anything tappable. Till controls (open/finish a shift, cash in/out)
            live on the Shift page now — this page is the roster and the clock. */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-10" onClick={() => setClockDialogOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" />
            {t("pages.scheduleClockInOut")}
          </Button>
        </div>
      </div>

      {images.length > 0 && (
        <section aria-label={t("pages.scheduleImageTitle")} className="space-y-3">
          {images.map((image) => (
            <Card key={image.id}>
              <CardContent className="space-y-2 py-3">
                <p className="text-sm font-semibold">
                  {/* Locale-formatted like the rest of the app, not the raw 2026-09-14 keys. */}
                  {format(parseLocalISO(image.startDate), "d MMM yyyy", { locale: dateLocale })} –{" "}
                  {format(parseLocalISO(image.endDate), "d MMM yyyy", { locale: dateLocale })}
                </p>
                {/* The roster as the manager uploaded it. Tap opens it full size,
                    where a phone can pinch-zoom the small print. */}
                <a href={image.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.imageUrl}
                    alt={t("pages.scheduleImageAlt")}
                    className="mx-auto max-h-[calc(75dvh/var(--app-zoom,1))] w-auto max-w-full rounded-lg border object-contain"
                  />
                </a>
                {image.note && <p className="text-muted-foreground text-xs">{image.note}</p>}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : upcoming.length === 0 ? (
        // An image alone is a published schedule — don't tell the person there isn't one.
        images.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("pages.scheduleNoPublishedSchedule")}</p>
        )
      ) : (
        <div className="space-y-2">
          {upcoming.map((entry) => (
            <Card key={entry.id} className={entry.date === today ? "border-primary/50" : undefined}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {entry.date}
                    {entry.date === today && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                        {t("pages.scheduleToday")}
                      </Badge>
                    )}
                  </p>
                  {entry.isDayOff ? (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <CalendarOff className="h-3.5 w-3.5" />
                      {t("pages.scheduleDayOffOn")}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {entry.scheduleShift
                        ? `${entry.scheduleShift.name} (${entry.scheduleShift.startTime}–${entry.scheduleShift.endTime})`
                        : `${entry.customStartTime}–${entry.customEndTime}`}
                    </p>
                  )}
                </div>
                {entry.department && <Badge variant="secondary">{entry.department}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <HistoryIcon className="h-4 w-4" />
            {t("pages.scheduleMyHistoryTitle")}
          </h2>
          <div className="flex items-center gap-2">
            <DateRangeField
              id="my-history-date-range"
              from={historyFrom}
              to={historyTo}
              onChange={(nextFrom, nextTo) => {
                setHistoryFrom(nextFrom);
                setHistoryTo(nextTo);
              }}
              align="end"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setHistorySort((s) => (s === "desc" ? "asc" : "desc"))}
              aria-label={
                historySort === "desc"
                  ? t("pages.scheduleHistorySortOldestFirst")
                  : t("pages.scheduleHistorySortNewestFirst")
              }
              title={
                historySort === "desc"
                  ? t("pages.scheduleHistorySortNewestFirst")
                  : t("pages.scheduleHistorySortOldestFirst")
              }
            >
              {historySort === "desc" ? (
                <ArrowDownNarrowWide className="h-4 w-4" aria-hidden />
              ) : (
                <ArrowUpNarrowWide className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
        {historyLoading ? (
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        ) : historyRecords.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("pages.noData")}</p>
        ) : (
          <div className="space-y-2">
            {historyRecords.map((record) => (
              <div
                key={record.id}
                className="border-border/60 flex items-center gap-3 rounded-lg border p-2.5"
              >
                {record.selfieUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={record.selfieUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <ImageOff className="text-muted-foreground/40 h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{typeLabel(record.type)}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {formatDateTime(record.timestamp)}
                  </p>
                  {record.locationLabel && (
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-[11px]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {record.locationLabel}
                    </p>
                  )}
                  {/* The reason a cash movement was recorded — the part a
                      cashier double-checks when their drawer doesn't balance. */}
                  {record.notes && (
                    <p className="text-muted-foreground line-clamp-2 text-[11px] break-words">
                      {record.notes}
                    </p>
                  )}
                </div>
                {record.amount != null && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {formatPrice(record.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ClockInOutDialog open={clockDialogOpen} onOpenChange={setClockDialogOpen} storeId={storeId} />
    </div>
  );
}
