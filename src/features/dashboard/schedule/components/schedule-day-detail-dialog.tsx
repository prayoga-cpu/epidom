"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/components/lang/i18n-provider";
import { parseLocalISO } from "@/lib/utils/date-range";
import type { StaffScheduleEntry } from "./staff-schedule-cell-dialog";

interface DayDetailEntry extends StaffScheduleEntry {
  staffMember: { id: string; name: string };
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
}

interface ScheduleDayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateKey: string;
  entries: DayDetailEntry[];
  /** Staff-facing view: hides entry notes and the Draft/Published badge. */
  hideManagerDetails?: boolean;
}

/** Read-only day-at-a-glance view — the week grid's cells are too cramped to show department/notes at once. */
export function ScheduleDayDetailDialog({
  open,
  onOpenChange,
  dateKey,
  entries,
  hideManagerDetails = false,
}: ScheduleDayDetailDialogProps) {
  const { t, dateLocale } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] max-w-md flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {format(parseLocalISO(dateKey), "EEEE d MMM yyyy", { locale: dateLocale })}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 space-y-2">
          {entries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("pages.noData")}</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-semibold">{entry.staffMember.name}</p>
                  {entry.isDayOff ? (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <CalendarOff className="h-3.5 w-3.5" />
                      {t("pages.scheduleDayOffOn")}
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {entry.scheduleShift
                        ? `${entry.scheduleShift.name} (${entry.scheduleShift.startTime}–${entry.scheduleShift.endTime})`
                        : `${entry.customStartTime}–${entry.customEndTime}`}
                    </p>
                  )}
                  {entry.department && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("pages.scheduleDepartment")}: {entry.department}
                    </p>
                  )}
                  {!hideManagerDetails && entry.notes && (
                    <p className="text-muted-foreground mt-1 text-xs">{entry.notes}</p>
                  )}
                </div>
                {!hideManagerDetails && (
                  <Badge variant={entry.status === "PUBLISHED" ? "default" : "secondary"}>
                    {entry.status === "PUBLISHED"
                      ? t("pages.schedulePublishedBadge")
                      : t("pages.scheduleDraftBadge")}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
