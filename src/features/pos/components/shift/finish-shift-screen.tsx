"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/shared/decimal-input";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { closeShiftSchema, type CloseShiftInput } from "@/lib/validation/operations.schemas";
import { mapPaymentMethodLabel } from "../../lib/order-status-display";
import {
  buildCashDetailRows,
  buildOtherPayments,
  cashDifference,
  DIFFERENCE_TONE_CLASSES,
  differenceTone,
  type CashDetailKey,
  type DifferenceTone,
} from "../../lib/shift-summary";
import { useCloseShift, useShiftReport, type TillShift } from "../../hooks/use-active-shift";
import { EndShiftConfirmDialog } from "./end-shift-confirm-dialog";
import type { EndedShift } from "./shift-closed-dialog";

interface FinishShiftScreenProps {
  storeId: string;
  shift: TillShift;
  onBack: () => void;
  onEnded: (ended: EndedShift) => void;
}

// One i18n key per cash row — the movement vocabulary already exists under
// `pages.*` (the same words the Cash In/Out picker and the dashboard use).
const CASH_ROW_LABELS: Record<CashDetailKey, string> = {
  openingCash: "pages.openingCash",
  cashSales: "pages.cashSales",
  cashRefunds: "pages.cashRefundsOut",
  tips: "pages.cashTips",
  floatTopUp: "pages.cashMovementTypePettyIn",
  paidOut: "pages.cashMovementTypePettyOut",
  safeDrop: "pages.cashMovementTypeDrop",
  tipsPaidOut: "pages.cashMovementTypePayout",
};

function MoneyRow({
  label,
  value,
  bold,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-sm",
        bold && "font-semibold",
        muted && "text-muted-foreground"
      )}
    >
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Finish shift — everything the cashier needs to count the drawer and sign off:
 * the cash the till is accountable for, what came in by other means, when the
 * shift started, how many orders it took, and a note for whoever opens next.
 *
 * Every figure comes from the server's live shift report (the same numbers the
 * printed report carries), so this screen cannot disagree with the paper. The
 * count is typed blind — nothing here pre-fills it with the expected figure,
 * which would turn "count the drawer" into "press OK".
 */
export function FinishShiftScreen({ storeId, shift, onBack, onEnded }: FinishShiftScreenProps) {
  const { t, formatDateTime } = useI18n();
  // Till floats, counts and drawer figures are literal in the store's own
  // currency. The bare one-arg formatPrice() defaults `fromCurrency` to IDR and
  // would convert them — passing the provider's own currency makes it identity.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  // Refetched on an interval: orders keep arriving from other tablets and the
  // storefront while the cashier is counting notes.
  const { data, isLoading, isError, refetch } = useShiftReport(storeId, shift.id, {
    refetchInterval: 30_000,
  });
  const closeShift = useCloseShift(storeId);

  const form = useForm<CloseShiftInput>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { notes: "" },
  });
  const counted = form.watch("closingCash");
  const notes = form.watch("notes") ?? "";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const report = data?.report;
  const drawer = report?.cashDrawer ?? null;
  const money = (value: number) => formatPriceRaw(value, currency);

  const cashRows = drawer ? buildCashDetailRows(drawer) : [];
  const others = report ? buildOtherPayments(report) : { rows: [], total: 0 };
  const difference = drawer ? cashDifference(counted, drawer.expectedCash) : null;
  const tone = differenceTone(difference);
  const signed = (value: number) => (value > 0 ? `+${money(value)}` : money(value));

  const toneLabel: Record<DifferenceTone, string | null> = {
    pending: null,
    balanced: t("pos.shift.differenceBalanced"),
    over: t("pos.shift.differenceOver"),
    short: t("pos.shift.differenceShort"),
  };

  const orderCountLabel = (n: number) =>
    n === 1 ? t("pos.shift.orderCountOne") : t("pos.shift.orderCount").replace("{n}", String(n));

  // Re-read the figures before showing the confirmation: the numbers the
  // cashier is about to sign off should be the latest, not up to 30s old.
  const requestEnd = form.handleSubmit(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
    setConfirmOpen(true);
  });

  const confirmEnd = async () => {
    const { closingCash, notes: note } = form.getValues();
    try {
      await closeShift.mutateAsync({
        shiftId: shift.id,
        closingCash,
        notes: note?.trim() || undefined,
      });
    } catch (error) {
      // 409: another account or tablet already ended it. Retrying can't work, and the
      // page drops back to the open-shift form once it re-reads.
      toast.error(
        error instanceof ApiClientError && error.status === 409
          ? t("pos.shift.alreadyEnded")
          : t("pos.shift.endFailed")
      );
      return;
    }
    setConfirmOpen(false);
    onEnded({ shiftId: shift.id, staffName: shift.staffMember?.name ?? null });
  };

  const canEnd = !!drawer && counted !== undefined && !isRefreshing;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-3 py-2 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={onBack}
          aria-label={t("pos.shift.back")}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{t("pos.shift.finishTitle")}</h2>
          <p className="text-muted-foreground truncate text-xs">
            {[data?.storeName, shift.staffMember?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="bg-muted/60 shrink-0 rounded-lg px-3 py-1.5 text-right">
          <p className="text-muted-foreground text-[11px]">{t("pos.shift.startedAt")}</p>
          <p className="text-xs font-semibold">{formatDateTime(shift.openedAt)}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-96 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          )}

          {isError && !report && (
            <div className="bg-card flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
              <p className="text-sm">{t("pos.shift.figuresFailed")}</p>
              <Button variant="outline" className="h-11" onClick={() => refetch()}>
                {t("common.actions.retry")}
              </Button>
            </div>
          )}

          {report && drawer && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Cash — by Order.shiftId linkage: what THIS till is accountable for. */}
                <section className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">{t("pos.shift.cashSection")}</h3>
                  <dl className="space-y-2">
                    {cashRows.map((row) => (
                      <MoneyRow
                        key={row.key}
                        label={t(CASH_ROW_LABELS[row.key])}
                        value={`${row.direction === "out" ? "-" : ""}${money(row.amount)}`}
                      />
                    ))}
                    <div className="border-t pt-2">
                      <MoneyRow
                        bold
                        label={t("pages.expectedCash")}
                        value={money(drawer.expectedCash)}
                      />
                    </div>
                  </dl>

                  {/* Visible, not counted — the schema can't say whether this cash
                      reached a drawer or a courier. Same line the printed report has. */}
                  {drawer.unlinkedCashSales > 0 && (
                    <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                      <div className="flex items-baseline justify-between gap-3 font-medium">
                        <span>{t("pos.shift.unlinkedCash")}</span>
                        <span className="tabular-nums">{money(drawer.unlinkedCashSales)}</span>
                      </div>
                      <p className="mt-0.5 opacity-80">{t("pos.shift.unlinkedCashHint")}</p>
                    </div>
                  )}

                  <div className="space-y-1.5 border-t pt-3">
                    <Label htmlFor="shift-counted-cash">{t("pos.shift.countedCash")}</Label>
                    <Controller
                      control={form.control}
                      name="closingCash"
                      render={({ field }) => (
                        <DecimalInput
                          id="shift-counted-cash"
                          className="h-12 text-lg"
                          decimals={2}
                          min={0}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      )}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("pos.shift.countedCashHint")}
                    </p>
                  </div>

                  <div
                    role="status"
                    className={cn("rounded-xl px-3 py-2.5 text-sm", DIFFERENCE_TONE_CLASSES[tone])}
                  >
                    <div className="flex items-baseline justify-between gap-3 font-semibold">
                      <span>
                        {t("pages.cashDifference")}
                        {toneLabel[tone] && (
                          <span className="ml-2 text-xs font-medium">({toneLabel[tone]})</span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {difference === null ? "—" : signed(difference)}
                      </span>
                    </div>
                    {difference === null && (
                      <p className="mt-0.5 text-xs">{t("pos.shift.differencePending")}</p>
                    )}
                  </div>
                </section>

                {/* Sales and non-cash payments — by the till's TIME WINDOW, so
                    storefront and aggregator orders taken while it was open count. */}
                <section className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">{t("pos.shift.salesSection")}</h3>
                  <dl className="space-y-2">
                    <MoneyRow label={t("pos.shift.orders")} value={String(report.invoices.count)} />
                    {report.cancellations.invoiceCount > 0 && (
                      <MoneyRow
                        muted
                        label={t("pos.shift.cancelledOrders")}
                        value={String(report.cancellations.invoiceCount)}
                      />
                    )}
                    <MoneyRow
                      bold
                      label={t("pos.shift.totalSales")}
                      value={money(report.sales.total)}
                    />
                  </dl>

                  <div className="space-y-2 border-t pt-3">
                    <h3 className="text-sm font-semibold">{t("pos.shift.paymentsSection")}</h3>
                    {others.rows.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("pos.shift.paymentsEmpty")}
                      </p>
                    ) : (
                      <dl className="space-y-2">
                        {others.rows.map((row) => (
                          <MoneyRow
                            key={row.paymentMethod}
                            label={
                              <>
                                {mapPaymentMethodLabel(t, row.paymentMethod)}
                                <span className="text-muted-foreground text-xs">
                                  {" · "}
                                  {orderCountLabel(row.orderCount)}
                                </span>
                              </>
                            }
                            value={money(row.revenue)}
                          />
                        ))}
                        <div className="border-t pt-2">
                          <MoneyRow
                            bold
                            label={t("pos.shift.paymentsTotal")}
                            value={money(others.total)}
                          />
                        </div>
                      </dl>
                    )}
                  </div>
                </section>
              </div>

              <section className="bg-card space-y-1.5 rounded-2xl border p-4 shadow-sm">
                <Label htmlFor="shift-close-note">{t("pos.shift.note")}</Label>
                <Textarea
                  id="shift-close-note"
                  rows={3}
                  maxLength={500}
                  className="min-h-0"
                  placeholder={t("pos.shift.notePlaceholder")}
                  {...form.register("notes")}
                />
              </section>
            </>
          )}
        </div>
      </div>

      {/* No bottom safe-area padding of its own: the POS Operational page, its
          only host, pads for the home indicator once for the whole page. */}
      <footer className="bg-background shrink-0 border-t p-3 md:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-1.5">
          {report && counted === undefined && (
            <p className="text-muted-foreground text-center text-xs">
              {t("pos.shift.countedRequired")}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={onBack}>
              {t("pos.shift.back")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-12 flex-1"
              disabled={!canEnd}
              onClick={requestEnd}
            >
              {isRefreshing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t("pos.shift.endShift")}
            </Button>
          </div>
        </div>
      </footer>

      {drawer && (
        <EndShiftConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          storeName={data?.storeName ?? ""}
          expectedCash={money(drawer.expectedCash)}
          countedCash={counted === undefined ? "—" : money(counted)}
          difference={difference === null ? "—" : signed(difference)}
          differenceTone={tone}
          otherPayments={money(others.total)}
          note={notes.trim()}
          pending={closeShift.isPending}
          onConfirm={confirmEnd}
        />
      )}
    </div>
  );
}
