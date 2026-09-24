"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { useActiveShift } from "@/features/pos/hooks/use-active-shift";

/**
 * The status bar's shift label: green with the start time while the persona's
 * till is open, amber "No shift" when it isn't — a cashier should never find out
 * at close that the day's sales weren't going against a drawer. Tapping it opens
 * the Operational page on its Shift tab either way.
 *
 * Renders nothing for a persona that can't hold a till (kitchen), and nothing
 * while the answer is unknown, so it can't claim "No shift" about a shift it
 * just hasn't loaded yet.
 *
 * It is also what keeps the POS session's `shiftId` truthful on every POS route
 * (see useActiveShift), which is why it mounts here and not only on the Shift page.
 */
export function PosModeShiftChip({ storeId }: { storeId: string }) {
  const { t, formatTimeOnly } = useI18n();
  const { shift, allowed, known } = useActiveShift(storeId);

  if (!allowed || !known) return null;

  const title = shift
    ? t("pos.shift.chipOpenTitle")
        .replace("{time}", formatTimeOnly(shift.openedAt))
        .replace("{name}", shift.staffMember?.name ?? "")
    : t("pos.shift.chipNoneTitle");

  return (
    <Link
      href={`/store/${storeId}/pos/operational?tab=shift`}
      title={title}
      aria-label={title}
      className={cn(
        // Same size as the status bar's Connected pill (px-2 py-0.5, gap-1) so the
        // two read as a pair. The ::before grows the tap target back to 40px
        // (AGENTS.md touch floor) without growing the pill itself.
        "relative flex shrink-0 touch-manipulation items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors before:absolute before:-inset-x-1 before:-inset-y-2.5",
        shift
          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
      )}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", shift ? "bg-emerald-500" : "bg-amber-500")}
        aria-hidden
      />
      {shift ? (
        <span className="whitespace-nowrap">
          <span className="hidden sm:inline">{t("pos.shift.chipLabel")} · </span>
          {formatTimeOnly(shift.openedAt)}
        </span>
      ) : (
        <span className="whitespace-nowrap">{t("pos.shift.chipNone")}</span>
      )}
    </Link>
  );
}
