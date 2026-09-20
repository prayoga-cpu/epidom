"use client";

import { Banknote, ReceiptText, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import type { TillShift } from "../../hooks/use-active-shift";

interface ShiftStatusCardProps {
  shift: TillShift;
  onFinish: () => void;
  onCashMovement: () => void;
  onViewReport: () => void;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 w-full rounded-xl px-4 py-3 text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

/**
 * The shift that is open right now: who is on charge, when it started, the
 * float it started with, and the one button that ends it. Kept deliberately
 * bare — the cash detail belongs to the finish screen, where it is needed.
 */
export function ShiftStatusCard({
  shift,
  onFinish,
  onCashMovement,
  onViewReport,
}: ShiftStatusCardProps) {
  const { t, formatDateTime } = useI18n();
  // Literal in the store's own currency — the bare one-arg formatPrice() would
  // treat it as IDR and re-scale every amount for a non-IDR store.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();

  return (
    <section
      aria-label={t("pos.shift.activeBadge")}
      className="bg-card mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border p-5 shadow-sm"
    >
      <div className="bg-muted flex size-24 items-center justify-center rounded-full border">
        <UserRound className="text-muted-foreground size-10" aria-hidden />
      </div>

      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        {t("pos.shift.activeBadge")}
      </span>

      <div className="text-center">
        {/* Who STARTED it — the shift is the store's, and whoever is looking at it
            may be a different account picking up at handover. */}
        <p className="text-muted-foreground text-xs">{t("pos.shift.startedBy")}</p>
        <p className="text-lg font-bold break-words">{shift.staffMember?.name ?? "—"}</p>
      </div>

      <InfoTile label={t("pos.shift.startedAt")} value={formatDateTime(shift.openedAt)} />
      <InfoTile
        label={t("pages.openingCash")}
        value={formatPriceRaw(Number(shift.openingCash), currency)}
      />

      <Button variant="destructive" className="h-12 w-full text-base" onClick={onFinish}>
        {t("pos.shift.finish")}
      </Button>

      {/* Two buttons in one row: flex-1 each, never w-full (AGENTS.md — width:100%
          ignores the sibling and overflows the row by exactly its width). */}
      <div className="flex w-full gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onCashMovement}>
          <Banknote className="mr-2 size-4" aria-hidden />
          {t("pages.cashMovementTitle")}
        </Button>
        <Button variant="outline" className="h-11 flex-1" onClick={onViewReport}>
          <ReceiptText className="mr-2 size-4" aria-hidden />
          {t("pages.shiftViewReport")}
        </Button>
      </div>
    </section>
  );
}
