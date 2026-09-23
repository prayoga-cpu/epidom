"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { shiftReportPath } from "@/lib/finance/shift-report-path";
import { useActiveShift } from "../../hooks/use-active-shift";
import { usePosSession } from "../../hooks/use-pos-session";
import { CashMovementDialog } from "./cash-movement-dialog";
import { FinishShiftScreen } from "./finish-shift-screen";
import { OpenShiftCard } from "./open-shift-card";
import { ShiftClosedDialog, type EndedShift } from "./shift-closed-dialog";
import { ShiftHistoryList } from "./shift-history-list";
import { ShiftStatusCard } from "./shift-status-card";

/**
 * POS Mode's Shift page — the one place a till session is opened, watched and
 * ended. Separate from My Schedule (clock in/out and the roster), which used to
 * carry these controls.
 *
 * A shift here is the `Shift` till session, not a `ScheduleShift` roster block:
 * someone counted a float into a drawer and is accountable for what is in it.
 */
export function ShiftPage({ storeId }: { storeId: string }) {
  const { t } = useI18n();
  const { shift, allowed, known, staffMemberId, isLoading, isError, refetch } =
    useActiveShift(storeId);
  // The owner's persona is logged in one tick after first render on stores that
  // skip the staff picker — that gap is "not known yet", not "your role can't".
  const sessionReady = usePosSession((s) => s.isActive && s.storeId === storeId);

  const [finishing, setFinishing] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [ended, setEnded] = useState<EndedShift | null>(null);

  const centered = (children: React.ReactNode) => (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-8 text-center">
        {children}
      </div>
    </div>
  );

  if (!sessionReady || isLoading) {
    return centered(<Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />);
  }

  if (!allowed) {
    return centered(
      <p className="text-muted-foreground text-sm">{t("pos.shift.unavailableRole")}</p>
    );
  }

  // Only when there is NO answer to show. The hook polls every minute, and a single
  // failed poll (a Wi-Fi blip) leaves isError set beside a perfectly good last-known
  // shift — replacing the page then would unmount the Finish screen and lose the
  // count the cashier is typing. Last-known data still counts.
  if (isError && !known) {
    return centered(
      <>
        <p className="text-sm">{t("pos.shift.loadFailed")}</p>
        <Button variant="outline" className="h-11" onClick={() => refetch()}>
          {t("common.actions.retry")}
        </Button>
      </>
    );
  }

  // The account owner with no staff profile to attribute a shift to (every store
  // normally has one, auto-created) — nothing a till session could belong to.
  if (!staffMemberId) {
    return centered(
      <p className="text-muted-foreground text-sm">{t("pos.shift.unavailableNoStaff")}</p>
    );
  }

  const reportHref = (id: string) => shiftReportPath(storeId, id);

  return (
    <>
      {finishing && shift ? (
        <FinishShiftScreen
          storeId={storeId}
          shift={shift}
          onBack={() => setFinishing(false)}
          onEnded={(result) => {
            setFinishing(false);
            setEnded(result);
          }}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
          <h2 className="sr-only">{t("pos.shift.title")}</h2>
          {shift ? (
            <ShiftStatusCard
              shift={shift}
              onFinish={() => setFinishing(true)}
              onCashMovement={() => setMovementOpen(true)}
              // A new tab, not an inline view: it is the standalone printable
              // report page, and mid-shift it is a live X-report.
              onViewReport={() => window.open(reportHref(shift.id), "_blank")}
            />
          ) : (
            <OpenShiftCard
              storeId={storeId}
              staffMemberId={staffMemberId}
              onCashMovement={() => setMovementOpen(true)}
            />
          )}
          {/* Under either card: the store's finished shifts, so a handover can see
              who ran the last one and how the drawer closed. */}
          <ShiftHistoryList storeId={storeId} />
        </div>
      )}

      <CashMovementDialog
        storeId={storeId}
        staffMemberId={staffMemberId}
        shiftId={shift?.id ?? null}
        open={movementOpen}
        onOpenChange={setMovementOpen}
      />

      {ended && (
        <ShiftClosedDialog
          key={ended.shiftId}
          storeId={storeId}
          ended={ended}
          onDone={() => setEnded(null)}
        />
      )}
    </>
  );
}
