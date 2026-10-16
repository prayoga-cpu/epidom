"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HoursReportRow } from "@/lib/attendance/hours-report";
import {
  isOvertimeDecidable,
  type OvertimeDecisionValue,
} from "@/lib/attendance/overtime-approval";
import { useHoursFormat } from "./use-hours-format";

interface OvertimeApprovalCellProps {
  day: HoursReportRow;
  /** The viewer's own row: a manager's overtime is the owner's to approve. */
  isSelf: boolean;
  busy: boolean;
  onDecide: (decision: OvertimeDecisionValue) => void;
  onUndo: () => void;
}

/**
 * The Hours tab's Overtime cell. With approval off it's the plain duration it
 * always was; with it on, the day's status — waiting, approved, turned down —
 * who decided, and the buttons to decide or undo.
 */
export function OvertimeApprovalCell({
  day,
  isSelf,
  busy,
  onDecide,
  onUndo,
}: OvertimeApprovalCellProps) {
  const { t, formatDate } = useI18n();
  const { duration } = useHoursFormat();
  const overtime = day.overtime;

  if (day.overtimeMinutes <= 0) return <>—</>;
  if (overtime.status === "automatic") {
    return <Badge variant="secondary">{duration(day.overtimeMinutes)}</Badge>;
  }

  const decision = overtime.decision;
  const notApproved = (minutes: number) =>
    t("pages.overtimeNotApprovedMinutes").replace("{hours}", duration(minutes));
  const badge =
    overtime.status === "approved" || overtime.status === "partial" ? (
      <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/15 dark:text-emerald-400">
        {duration(overtime.paidMinutes)} · {t("pages.overtimeStatusApproved")}
      </Badge>
    ) : overtime.status === "rejected" ? (
      <Badge variant="outline" className="text-muted-foreground line-through decoration-1">
        {duration(overtime.rejectedMinutes)}
      </Badge>
    ) : (
      <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
        {duration(overtime.pendingMinutes)} · {t("pages.overtimeStatusWaiting")}
      </Badge>
    );

  // A day decided before its clock-out was corrected to a later time: the
  // earlier minutes keep their decision, only the extra waits.
  const earlier =
    overtime.status === "pending" && decision
      ? [
          overtime.paidMinutes > 0 &&
            t("pages.overtimePartlyApproved").replace("{hours}", duration(overtime.paidMinutes)),
          overtime.rejectedMinutes > 0 &&
            t("pages.overtimePartlyRejected").replace(
              "{hours}",
              duration(overtime.rejectedMinutes)
            ),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const decidedBy =
    decision && overtime.status !== "pending"
      ? (overtime.status === "approved"
          ? t("pages.overtimeApprovedBy")
          : overtime.status === "rejected"
            ? t("pages.overtimeRejectedBy")
            : t("pages.overtimeDecidedBy")
        )
          .replace("{name}", decision.decidedByName)
          .replace("{date}", formatDate(decision.decidedAt))
      : null;

  const decidable = isOvertimeDecidable(day);
  return (
    <div className="min-w-[180px] space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {badge}
        {overtime.status === "rejected" && (
          <span className="text-muted-foreground text-xs">{t("pages.overtimeStatusRejected")}</span>
        )}
        {overtime.status === "partial" && (
          <span className="text-muted-foreground text-xs">
            {notApproved(overtime.rejectedMinutes)}
          </span>
        )}
      </div>
      {earlier && <p className="text-muted-foreground text-xs">{earlier}</p>}
      {decidedBy && <p className="text-muted-foreground text-xs">{decidedBy}</p>}

      {isSelf ? (
        <p className="text-muted-foreground text-xs">{t("pages.overtimeOwnerApprovesYours")}</p>
      ) : !decidable ? (
        overtime.status === "pending" && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("pages.overtimeFinishDayFirst")}
          </p>
        )
      ) : overtime.status === "pending" ? (
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-10 flex-1 px-3"
            disabled={busy}
            onClick={() => onDecide("APPROVED")}
          >
            <Check className="mr-1 h-4 w-4" />
            {t("pages.overtimeApprove")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 px-3"
            disabled={busy}
            onClick={() => onDecide("REJECTED")}
            aria-label={`${t("pages.overtimeReject")} — ${duration(overtime.pendingMinutes)}`}
          >
            <X className="mr-1 h-4 w-4" />
            {t("pages.overtimeReject")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-10 px-2"
          disabled={busy}
          onClick={onUndo}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          {t("pages.overtimeUndo")}
        </Button>
      )}
    </div>
  );
}
