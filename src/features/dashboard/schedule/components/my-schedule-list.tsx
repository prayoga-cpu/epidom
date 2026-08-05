"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarOff } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { todayLocalISO } from "@/lib/utils/date-range";
import type { StaffScheduleEntry } from "./staff-schedule-cell-dialog";

interface MySchedule extends StaffScheduleEntry {
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
}

export function MyScheduleList({ storeId, staffMemberId }: { storeId: string; staffMemberId: string }) {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["staff-schedules", storeId, "mine", staffMemberId],
    queryFn: () =>
      apiClient.get<{ schedules: MySchedule[] }>(`/stores/${storeId}/staff-schedules`, {
        staffId: staffMemberId,
        from: todayLocalISO(),
      }),
  });

  const upcoming = (data?.schedules ?? []).filter((s) => s.date >= todayLocalISO());

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("pages.scheduleMyScheduleTitle")}</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : upcoming.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("pages.scheduleNoPublishedSchedule")}</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{entry.date}</p>
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
    </div>
  );
}
