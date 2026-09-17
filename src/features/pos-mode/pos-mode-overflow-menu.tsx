"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Monitor,
  KeyRound,
  CalendarClock,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCustomerDisplaySettings } from "@/features/pos/hooks/use-customer-display-settings";
import { openCustomerDisplay } from "@/features/pos/lib/open-customer-display";
import { ClockInOutDialog } from "@/features/dashboard/shared/clock-in-out-dialog";
import { useAccountSwitcher } from "@/features/dashboard/shared/hooks/use-account-switcher";
import { VerifyOwnerPinDialog } from "@/features/dashboard/shared/verify-owner-pin-dialog";
import { SetOwnerPinDialog } from "@/features/dashboard/shared/set-owner-pin-dialog";

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

  const {
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    verifyOwnerOpen,
    setVerifyOwnerOpen,
    setOwnerPinOpen,
    setSetOwnerPinOpen,
    handleBackToOwnerClick,
    handleSwitchedBackToOwner,
    handleReturnToPicker,
    handleOwnerAccountLogout,
  } = useAccountSwitcher(storeId);

  // The one deliberate way back into Back Office from this shell
  // (docs/back-office-revamp.md) — Owner/Manager only. Cashier/Kitchen never
  // see this: their allowedPages has no Back Office pages to land on, and
  // showing them a link into a shell they'd immediately be redirected out of
  // would be a dead end, not a shortcut.
  const canReachBackOffice = posSession.staffRole === "OWNER" || posSession.staffRole === "MANAGER";

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

            {/* Clock in/out — a timesheet action for the persona already
                active. Deliberately its own row, not grouped with the
                "who is this device" actions below — different question,
                different answer. */}
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

            {/* Who's using this device — switching or logging out, not
                clocking in/out. Same actions, same reload/cache-clearing
                behavior as Back Office's NavUser dropdown
                (useAccountSwitcher), now reachable without leaving POS
                Mode first. */}
            <div className="space-y-2 border-t pt-4">
              <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
                {posSession.staffName}
                {posSession.staffRole ? ` · ${posSession.staffRole}` : ""}
              </p>

              {actingAsStaff ? (
                <>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    onClick={handleBackToOwnerClick}
                  >
                    <KeyRound className="size-4" aria-hidden />
                    {t("nav.switchAccount")} ({t("pages.staffRoleOwner")})
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    onClick={() => {
                      onOpenChange(false);
                      handleReturnToPicker();
                    }}
                  >
                    <LogOut className="size-4" aria-hidden />
                    {t("nav.logoutStaffSession")}
                  </Button>
                </>
              ) : (
                hasSwitchableStaff && (
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    onClick={() => {
                      onOpenChange(false);
                      handleReturnToPicker();
                    }}
                  >
                    <RefreshCw className="size-4" aria-hidden />
                    {t("nav.switchAccount")}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                className="text-destructive hover:text-destructive h-11 w-full justify-start gap-2"
                onClick={() => {
                  onOpenChange(false);
                  handleOwnerAccountLogout();
                }}
              >
                <LogOut className="size-4" aria-hidden />
                {t("nav.logoutOwnerAccount")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClockInOutDialog open={clockOpen} onOpenChange={setClockOpen} storeId={storeId} />
      <VerifyOwnerPinDialog
        open={verifyOwnerOpen}
        onOpenChange={setVerifyOwnerOpen}
        onVerified={handleSwitchedBackToOwner}
      />
      <SetOwnerPinDialog
        open={setOwnerPinOpen}
        onOpenChange={setSetOwnerPinOpen}
        title="Set Owner PIN to continue"
        description="No Owner PIN is set yet. Set one now to switch this device back to your Owner account."
        onSuccess={handleSwitchedBackToOwner}
      />
    </>
  );
}
