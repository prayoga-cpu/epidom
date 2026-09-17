"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, KeyRound, CalendarClock, ExternalLink, LayoutDashboard } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCustomerDisplaySettings } from "@/features/pos/hooks/use-customer-display-settings";
import { openCustomerDisplay } from "@/features/pos/lib/open-customer-display";
import { ClockInOutDialog } from "@/features/dashboard/shared/clock-in-out-dialog";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";

interface PosModeOverflowMenuProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Low-frequency POS Mode actions that don't earn permanent tab-bar real
 * estate (spec: customer display trigger + clock in/out). Dialog, not Sheet
 * — same fixed-height reasoning as PosMobileCart's own comment: a bottom
 * Sheet never gets a truly definite height through this nested flex/scroll
 * chain, Dialog does.
 */
export function PosModeOverflowMenu({ storeId, open, onOpenChange }: PosModeOverflowMenuProps) {
  const { t } = useI18n();
  const displayEnabled = useCustomerDisplaySettings((state) => state.enabled);
  const setDisplayEnabled = useCustomerDisplaySettings((state) => state.setEnabled);
  const [clockOpen, setClockOpen] = useState(false);
  // The one deliberate way back into Back Office from this shell
  // (docs/back-office-revamp.md) — Owner/Manager only. Cashier/Kitchen never
  // see this: their allowedPages has no Back Office pages to land on, and
  // showing them a link into a shell they'd immediately be redirected out of
  // would be a dead end, not a shortcut.
  const { staffRole } = usePosSession();
  const canReachBackOffice = staffRole === "OWNER" || staffRole === "MANAGER";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(85dvh/var(--app-zoom,1))] overflow-y-auto rounded-3xl sm:max-w-sm">
          <DialogTitle>{t("common.actions.more")}</DialogTitle>
          <DialogDescription className="sr-only">{t("common.actions.more")}</DialogDescription>

          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Monitor
                    className={displayEnabled ? "size-5 shrink-0 text-emerald-500" : "size-5 shrink-0"}
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{t("pos.customerDisplay.enable")}</span>
                </div>
                <Switch checked={displayEnabled} onCheckedChange={setDisplayEnabled} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-full gap-1.5"
                disabled={!displayEnabled}
                onClick={() => openCustomerDisplay(storeId)}
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("pos.customerDisplay.openWindow")}
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full justify-start gap-2"
              onClick={() => {
                onOpenChange(false);
                setClockOpen(true);
              }}
            >
              <KeyRound className="size-4" aria-hidden />
              {t("clockInOut.dialogTitle")}
            </Button>

            <Button asChild variant="outline" className="h-11 w-full justify-start gap-2">
              <Link href={`/store/${storeId}/pos/schedule`} onClick={() => onOpenChange(false)}>
                <CalendarClock className="size-4" aria-hidden />
                {t("pages.scheduleMyScheduleTitle")}
              </Link>
            </Button>

            {canReachBackOffice && (
              <Button asChild variant="outline" className="h-11 w-full justify-start gap-2">
                <Link href={`/store/${storeId}/dashboard`} onClick={() => onOpenChange(false)}>
                  <LayoutDashboard className="size-4" aria-hidden />
                  {t("nav.dashboard")}
                </Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ClockInOutDialog open={clockOpen} onOpenChange={setClockOpen} storeId={storeId} />
    </>
  );
}
