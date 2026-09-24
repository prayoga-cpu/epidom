"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClockInOutPanel } from "./clock-in-out-panel";

interface ClockInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

/**
 * Clock in / out in a dialog. The flow itself is ClockInOutPanel (also rendered
 * inline on the POS Operational page); closing the dialog unmounts the panel,
 * so every open starts fresh and the selfie camera is released.
 */
export function ClockInOutDialog({ open, onOpenChange, storeId }: ClockInOutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] max-w-sm flex-col overflow-y-auto">
        <ClockInOutPanel
          storeId={storeId}
          onComplete={() => onOpenChange(false)}
          Title={DialogTitle}
          Description={DialogDescription}
        />
      </DialogContent>
    </Dialog>
  );
}
