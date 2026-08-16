"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";

export interface ScheduleShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isActive: boolean;
}

interface ScheduleShiftBlocksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export function ScheduleShiftBlocksDialog({
  open,
  onOpenChange,
  storeId,
}: ScheduleShiftBlocksDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [color, setColor] = useState("#22c55e");

  const { data } = useQuery({
    queryKey: ["schedule-shifts", storeId, "all"],
    queryFn: () =>
      apiClient.get<{ scheduleShifts: ScheduleShiftOption[] }>(
        `/stores/${storeId}/schedule-shifts`,
        { includeInactive: "true" }
      ),
    enabled: open,
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setStartTime("08:00");
    setEndTime("16:00");
    setColor("#22c55e");
  };

  const startEdit = (block: ScheduleShiftOption) => {
    setEditingId(block.id);
    setName(block.name);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setColor(block.color ?? "#22c55e");
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["schedule-shifts", storeId] });

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editingId) {
        await apiClient.patch(`/stores/${storeId}/schedule-shifts/${editingId}`, {
          name,
          startTime,
          endTime,
          color,
        });
      } else {
        await apiClient.post(`/stores/${storeId}/schedule-shifts`, {
          name,
          startTime,
          endTime,
          color,
        });
      }
      toast.success(t("pages.scheduleBlockSaved"));
      resetForm();
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await apiClient.delete(`/stores/${storeId}/schedule-shifts/${id}`);
      invalidate();
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] max-w-md flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pages.scheduleManageBlocks")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 space-y-2">
          {(data?.scheduleShifts ?? [])
            .filter((b) => b.isActive)
            .map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: block.color ?? "#94a3b8" }}
                  />
                  <span className="text-sm font-medium">{block.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {block.startTime}–{block.endTime}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => startEdit(block)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-red-500"
                    onClick={() => handleDeactivate(block.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label>{t("pages.scheduleBlockName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={t("pages.scheduleBlockNamePlaceholder")}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>{t("pages.scheduleStartTime")}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label>{t("pages.scheduleEndTime")}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("pages.scheduleColor")}</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 p-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {editingId && (
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={resetForm}>
                {t("common.actions.cancel")}
              </Button>
            )}
            <Button type="button" className="h-11 flex-1" onClick={handleSave}>
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? t("common.actions.save") : t("pages.scheduleAddBlock")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
