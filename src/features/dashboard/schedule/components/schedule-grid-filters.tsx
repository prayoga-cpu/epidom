"use client";

import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@prisma/client";
import type { ScheduleShiftOption } from "./schedule-shift-blocks-dialog";

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

interface ScheduleGridFiltersProps {
  staff: StaffOption[];
  scheduleShifts: ScheduleShiftOption[];
  staffFilter: string[];
  onStaffFilterChange: (ids: string[]) => void;
  blockFilter: string[];
  onBlockFilterChange: (ids: string[]) => void;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export function ScheduleGridFilters({
  staff,
  scheduleShifts,
  staffFilter,
  onStaffFilterChange,
  blockFilter,
  onBlockFilterChange,
}: ScheduleGridFiltersProps) {
  const { t } = useI18n();
  const activeBlocks = scheduleShifts.filter((b) => b.isActive);

  const staffLabel =
    staffFilter.length === 0
      ? t("pages.scheduleFilterAllStaff")
      : staffFilter.length === 1
        ? (staff.find((s) => s.id === staffFilter[0])?.name ?? t("pages.scheduleFilterAllStaff"))
        : t("pages.scheduleFilterStaffCount").replace("{count}", String(staffFilter.length));

  const blockLabel =
    blockFilter.length === 0
      ? t("pages.scheduleFilterAllBlocks")
      : blockFilter.length === 1
        ? (activeBlocks.find((b) => b.id === blockFilter[0])?.name ?? t("pages.scheduleFilterAllBlocks"))
        : t("pages.scheduleFilterBlockCount").replace("{count}", String(blockFilter.length));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-9", staffFilter.length > 0 && "border-primary text-primary")}
          >
            <ListFilter className="mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="max-w-32 truncate">{staffLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {t("pages.scheduleFilterStaffLabel")}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {staff.map((member) => (
              <button
                key={member.id}
                type="button"
                className="hover:bg-muted flex min-h-10 w-full items-center gap-2 rounded-md p-2 text-left text-sm"
                onClick={() => onStaffFilterChange(toggleId(staffFilter, member.id))}
              >
                <Checkbox checked={staffFilter.includes(member.id)} className="pointer-events-none" />
                <span className="truncate">{member.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-9", blockFilter.length > 0 && "border-primary text-primary")}
          >
            <ListFilter className="mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="max-w-32 truncate">{blockLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {t("pages.scheduleFilterBlockLabel")}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {activeBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                className="hover:bg-muted flex min-h-10 w-full items-center gap-2 rounded-md p-2 text-left text-sm"
                onClick={() => onBlockFilterChange(toggleId(blockFilter, block.id))}
              >
                <Checkbox checked={blockFilter.includes(block.id)} className="pointer-events-none" />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: block.color ?? "#94a3b8" }}
                />
                <span className="truncate">{block.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {(staffFilter.length > 0 || blockFilter.length > 0) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-9"
          onClick={() => {
            onStaffFilterChange([]);
            onBlockFilterChange([]);
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {t("pages.scheduleFilterClear")}
        </Button>
      )}
    </div>
  );
}
