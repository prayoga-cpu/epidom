"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@prisma/client";
import type { ScheduleShiftOption } from "./schedule-shift-blocks-dialog";

const BULK_CHUNK_SIZE = 200; // matches staffScheduleBulkSchema's entries.max(200)

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

interface ExistingScheduleKey {
  staffMember: { id: string };
  date: string;
}

interface ApplyShiftTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  staff: StaffOption[];
  scheduleShifts: ScheduleShiftOption[];
  weekDays: string[];
  weekdayFormatter: Intl.DateTimeFormat;
  existingSchedules: ExistingScheduleKey[];
  onApplied: () => void;
}

function isWeekday(dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day !== 0 && day !== 6;
}

export function ApplyShiftTemplateDialog({
  open,
  onOpenChange,
  storeId,
  staff,
  scheduleShifts,
  weekDays,
  weekdayFormatter,
  existingSchedules,
  onApplied,
}: ApplyShiftTemplateDialogProps) {
  const { t } = useI18n();
  const [scheduleShiftId, setScheduleShiftId] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [department, setDepartment] = useState("none");
  const [saving, setSaving] = useState(false);

  const activeBlocks = scheduleShifts.filter((b) => b.isActive);

  useEffect(() => {
    if (!open) return;
    setScheduleShiftId("");
    setSelectedStaffIds(new Set());
    setSelectedDays(new Set(weekDays.filter(isWeekday)));
    setDepartment("none");
  }, [open, weekDays]);

  const existingKeySet = useMemo(
    () => new Set(existingSchedules.map((s) => `${s.staffMember.id}|${s.date.slice(0, 10)}`)),
    [existingSchedules]
  );

  const { toCreate, skipped } = useMemo(() => {
    const entries: { staffMemberId: string; date: string }[] = [];
    let skippedCount = 0;
    for (const staffMemberId of selectedStaffIds) {
      for (const date of selectedDays) {
        if (existingKeySet.has(`${staffMemberId}|${date}`)) {
          skippedCount++;
        } else {
          entries.push({ staffMemberId, date });
        }
      }
    }
    return { toCreate: entries, skipped: skippedCount };
  }, [selectedStaffIds, selectedDays, existingKeySet]);

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleApply = async () => {
    if (!scheduleShiftId || toCreate.length === 0) return;
    setSaving(true);
    try {
      const entries = toCreate.map(({ staffMemberId, date }) => ({
        staffMemberId,
        date,
        scheduleShiftId,
        ...(department !== "none" && { department }),
      }));

      let applied = 0;
      for (let i = 0; i < entries.length; i += BULK_CHUNK_SIZE) {
        const chunk = entries.slice(i, i + BULK_CHUNK_SIZE);
        const res = await apiClient.post<{ count: number }>(
          `/stores/${storeId}/staff-schedules/bulk`,
          { entries: chunk }
        );
        applied += res.count;
      }

      toast.success(
        t("pages.scheduleApplyTemplateResult")
          .replace("{applied}", String(applied))
          .replace("{skipped}", String(skipped))
      );
      onApplied();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] max-w-md flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pages.scheduleApplyTemplate")}</DialogTitle>
          <DialogDescription>{t("pages.scheduleApplyTemplateDesc")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4">
          <div className="space-y-1">
            <Label>{t("pages.scheduleShiftBlockLabel")}</Label>
            {activeBlocks.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("pages.scheduleApplyTemplateNoBlocks")}</p>
            ) : (
              <Select value={scheduleShiftId} onValueChange={setScheduleShiftId} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeBlocks.map((block) => (
                    <SelectItem key={block.id} value={block.id}>
                      {block.name} ({block.startTime}–{block.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>{t("pages.scheduleApplyTemplateStaffLabel")}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground h-8"
                disabled={saving}
                onClick={() => setSelectedStaffIds(new Set(staff.map((s) => s.id)))}
              >
                {t("pages.scheduleApplyTemplateSelectAll")}
              </Button>
            </div>
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-1">
              {staff.map((member) => (
                <div
                  key={member.id}
                  role="button"
                  tabIndex={saving ? -1 : 0}
                  aria-disabled={saving}
                  className={cn(
                    "hover:bg-muted flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm",
                    saving && "pointer-events-none opacity-50"
                  )}
                  onClick={() => toggleStaff(member.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleStaff(member.id);
                    }
                  }}
                >
                  <Checkbox checked={selectedStaffIds.has(member.id)} className="pointer-events-none" />
                  <span className="truncate">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("pages.scheduleApplyTemplateDaysLabel")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {weekDays.map((day) => {
                const active = selectedDays.has(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={saving}
                    className={cn(
                      "flex min-h-10 min-w-14 flex-col items-center justify-center rounded-md border px-2 py-1 text-xs disabled:opacity-50",
                      active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => toggleDay(day)}
                  >
                    <span className="font-medium uppercase">{weekdayFormatter.format(new Date(`${day}T00:00:00Z`))}</span>
                    <span>{day.slice(5)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("pages.scheduleDepartment")}</Label>
            <Select value={department} onValueChange={setDepartment} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="KITCHEN">{t("pages.departmentKitchen")}</SelectItem>
                <SelectItem value="BAR">{t("pages.departmentBar")}</SelectItem>
                <SelectItem value="BOTH">{t("pages.departmentBoth")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!scheduleShiftId || toCreate.length === 0 || saving}
            onClick={handleApply}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pages.scheduleApplyTemplateSubmit").replace("{count}", String(toCreate.length))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
