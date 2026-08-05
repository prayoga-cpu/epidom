"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, CalendarOff } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { ScheduleShiftOption } from "./schedule-shift-blocks-dialog";

export interface StaffScheduleEntry {
  id: string;
  date: string;
  scheduleShiftId: string | null;
  customStartTime: string | null;
  customEndTime: string | null;
  isDayOff: boolean;
  department: "KITCHEN" | "BAR" | "BOTH" | null;
  notes: string | null;
  status: "DRAFT" | "PUBLISHED";
}

interface StaffScheduleCellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  staffMemberId: string;
  dateKey: string;
  scheduleShifts: ScheduleShiftOption[];
  existing: StaffScheduleEntry | null;
  onSaved: () => void;
}

export function StaffScheduleCellDialog({
  open,
  onOpenChange,
  storeId,
  staffMemberId,
  dateKey,
  scheduleShifts,
  existing,
  onSaved,
}: StaffScheduleCellDialogProps) {
  const { t } = useI18n();
  const [isDayOff, setIsDayOff] = useState(false);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [scheduleShiftId, setScheduleShiftId] = useState<string>("");
  const [customStartTime, setCustomStartTime] = useState("08:00");
  const [customEndTime, setCustomEndTime] = useState("16:00");
  const [department, setDepartment] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setIsDayOff(existing.isDayOff);
      setUseCustomTime(!existing.isDayOff && !existing.scheduleShiftId);
      setScheduleShiftId(existing.scheduleShiftId ?? "");
      setCustomStartTime(existing.customStartTime ?? "08:00");
      setCustomEndTime(existing.customEndTime ?? "16:00");
      setDepartment(existing.department ?? "none");
      setNotes(existing.notes ?? "");
    } else {
      setIsDayOff(false);
      setUseCustomTime(false);
      setScheduleShiftId(scheduleShifts[0]?.id ?? "");
      setCustomStartTime("08:00");
      setCustomEndTime("16:00");
      setDepartment("none");
      setNotes("");
    }
  }, [open, existing, scheduleShifts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        staffMemberId,
        date: dateKey,
        ...(isDayOff
          ? { isDayOff: true }
          : useCustomTime
            ? { customStartTime, customEndTime }
            : { scheduleShiftId: scheduleShiftId || undefined }),
        ...(department !== "none" && { department }),
        notes: notes || undefined,
      };

      if (existing) {
        await apiClient.patch(`/stores/${storeId}/staff-schedules/${existing.id}`, {
          scheduleShiftId: !isDayOff && !useCustomTime ? scheduleShiftId || null : null,
          customStartTime: !isDayOff && useCustomTime ? customStartTime : null,
          customEndTime: !isDayOff && useCustomTime ? customEndTime : null,
          isDayOff,
          department: department !== "none" ? department : null,
          notes: notes || "",
        });
      } else {
        await apiClient.post(`/stores/${storeId}/staff-schedules`, payload);
      }
      toast.success(t("pages.scheduleEntrySaved"));
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await apiClient.delete(`/stores/${storeId}/staff-schedules/${existing.id}`);
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-sm flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dateKey}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 space-y-3">
          <Button
            type="button"
            variant={isDayOff ? "default" : "outline"}
            className="h-11 w-full"
            onClick={() => setIsDayOff((v) => !v)}
          >
            <CalendarOff className="mr-2 h-4 w-4" />
            {isDayOff ? t("pages.scheduleDayOffOn") : t("pages.scheduleMarkDayOff")}
          </Button>

          {!isDayOff && (
            <>
              {!useCustomTime && (
                <div className="space-y-1">
                  <Label>{t("pages.scheduleShiftBlockLabel")}</Label>
                  <Select value={scheduleShiftId} onValueChange={setScheduleShiftId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scheduleShifts.map((block) => (
                        <SelectItem key={block.id} value={block.id}>
                          {block.name} ({block.startTime}–{block.endTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">{t("pages.scheduleCustomTime")}</Label>
                <Switch checked={useCustomTime} onCheckedChange={setUseCustomTime} />
              </div>

              {useCustomTime && (
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label>{t("pages.scheduleStartTime")}</Label>
                    <Input
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>{t("pages.scheduleEndTime")}</Label>
                    <Input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label>{t("pages.scheduleDepartment")}</Label>
            <Select value={department} onValueChange={setDepartment}>
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

          <div className="space-y-1">
            <Label>{t("pages.scheduleNotes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={300}
              className="min-h-0"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t pt-3">
          {existing && (
            <Button
              type="button"
              variant="outline"
              className="h-11 text-red-500"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" className="h-11 flex-1" onClick={handleSave} disabled={saving}>
            {t("common.actions.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
