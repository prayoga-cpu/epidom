"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatCurrency } from "@/lib/utils/formatting";
import {
  RECEIPT_INTL_LOCALE,
  RECEIPT_LABELS,
  RECEIPT_POWERED_BY_URL,
  SHIFT_REPORT_LABELS,
  resolveReceiptLocale,
} from "@/lib/receipts/receipt-labels";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Bluetooth } from "lucide-react";
import { toast } from "sonner";
import {
  isBluetoothSupported,
  isPrinterConnected,
  printShiftReport,
} from "@/lib/pwa/thermal-printer";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { mapPaymentMethodLabel } from "../lib/order-status-display";
import type { ShiftReportData } from "@/lib/finance/shift-report";

interface ShiftReportPrintViewProps {
  report: ShiftReportData;
  storeName: string;
  currency: string;
  shiftLabel: string | null;
  generatedAt: string;
  /** Skip the auto window.print() — used when the page is opened to *read*
   * the report (e.g. the "View report" link after closing a shift) rather
   * than to immediately put it on paper. */
  autoPrint?: boolean;
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-gray-300" />;
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Divider />
      <p className="font-bold">{children}</p>
      <div className="mt-1 mb-1 border-t border-gray-300" />
    </>
  );
}

/**
 * Screen/print rendering of the shift / daily report — the visual counterpart
 * to buildShiftReportEscPos() in thermal-printer.ts. Both consume the same
 * ShiftReportData, so the paper and this page can never show different totals.
 *
 * Rendered as a fixed white/black receipt column regardless of the app theme
 * (see ReceiptDocument for the same `print-report` rationale) — it emulates a
 * physical printed artifact, not app UI.
 */
export function ShiftReportPrintView({
  report,
  storeName,
  currency,
  shiftLabel,
  generatedAt,
  autoPrint = true,
}: ShiftReportPrintViewProps) {
  const { t, locale } = useI18n();
  const receiptLocale = resolveReceiptLocale(locale);
  const labels = SHIFT_REPORT_LABELS[receiptLocale];
  const intlLocale = RECEIPT_INTL_LOCALE[receiptLocale];
  const [isPrinting, setIsPrinting] = useState(false);
  const paperWidth = usePrinterSettings((s) => s.paperWidth);

  // Amounts are literal in the store's display currency, never IDR — same
  // model as the rest of the POS (see build-receipt-data.ts).
  const money = (amount: number) => formatCurrency(amount, currency, intlLocale);
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value)
    );

  useEffect(() => {
    if (!autoPrint) return;
    // Same 400ms settle as order-history-print-view.tsx — gives the layout a
    // frame to paint before the browser snapshots it for the print dialog.
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  const handleThermalPrint = async () => {
    if (isPrinting) return;
    if (!isBluetoothSupported()) {
      toast.error(t("pos.print.bluetoothUnsupported"));
      return;
    }
    setIsPrinting(true);
    try {
      if (!isPrinterConnected()) {
        const ok = await usePrinterSettings.getState().connect();
        if (!ok) {
          toast.error(t("pos.print.connectFailed"));
          return;
        }
      }
      await printShiftReport({
        report,
        storeName,
        currency,
        locale: receiptLocale,
        width: paperWidth,
        shiftLabel,
        generatedAt: new Date(generatedAt),
      });
      toast.success(t("pos.print.success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pos.print.failed"));
    } finally {
      setIsPrinting(false);
    }
  };

  const orderTypeLabel = (orderType: string) =>
    orderType === "DINE_IN"
      ? labels.dineIn
      : orderType === "TAKEAWAY"
        ? labels.takeaway
        : labels.deliveryType;

  return (
    <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] flex-col items-center gap-4 bg-gray-100 px-4 py-6 print:bg-white print:p-0">
      {/* Non-printing toolbar */}
      <div className="flex w-full max-w-sm flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-muted-foreground text-xs">{t("pos.printReport.toolbarHint")}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("pos.printReport.printAgain")}
          </Button>
          <Button size="sm" onClick={handleThermalPrint} disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bluetooth className="mr-2 h-4 w-4" />
            )}
            {t("pos.history.printThermal")}
          </Button>
        </div>
      </div>

      <div className="print-report mx-auto w-full max-w-sm rounded-sm bg-white p-6 font-mono text-xs text-black shadow-sm print:max-w-none print:shadow-none">
        {/* Header */}
        <div className="text-center">
          <p className="text-base font-bold tracking-wide">{storeName}</p>
          <p className="mt-0.5 font-bold">
            {report.cashDrawer ? labels.shiftReportTitle : labels.title}
          </p>
        </div>

        <Divider />
        <div className="space-y-0.5">
          <Row label={labels.period} value={dateTime(report.window.from)} />
          <Row
            label=""
            value={
              report.window.isOpen
                ? `${dateTime(report.window.to)} (${labels.stillOpen})`
                : dateTime(report.window.to)
            }
          />
          {shiftLabel && <Row label={labels.cashier} value={shiftLabel} />}
        </div>

        {/* Sales */}
        <Divider />
        <div className="space-y-0.5">
          <Row label={labels.grossSales} value={money(report.sales.grossSales)} />
          {!!report.sales.discount && (
            <Row label={labels.discount} value={`-${money(report.sales.discount)}`} />
          )}
          {!!report.sales.serviceCharge && (
            <Row label={labels.serviceCharge} value={money(report.sales.serviceCharge)} />
          )}
          {!!report.sales.tax && <Row label={labels.tax} value={money(report.sales.tax)} />}
          {!!report.sales.processingFee && (
            <Row label={labels.processingFee} value={money(report.sales.processingFee)} />
          )}
          {!!report.sales.delivery && (
            <Row label={labels.delivery} value={money(report.sales.delivery)} />
          )}
          {!!report.sales.refund && (
            <Row label={labels.refund} value={`-${money(report.sales.refund)}`} />
          )}
        </div>
        <div className="mt-1 border-t border-gray-300 pt-1">
          <Row label={labels.total} value={money(report.sales.total)} bold />
        </div>

        {report.invoices.count === 0 && (
          <p className="mt-3 text-center text-gray-600">{labels.noData}</p>
        )}

        {/* Invoices */}
        <Heading>{labels.invoicesHeading}</Heading>
        <div className="space-y-0.5">
          <Row label={labels.invoiceCount} value={String(report.invoices.count)} />
          <Row
            label={labels.averagePerInvoice}
            value={money(report.invoices.averagePerInvoice)}
          />
        </div>

        {/* Cancellations */}
        <Heading>{labels.cancellationsHeading}</Heading>
        <div className="space-y-0.5">
          <Row label={labels.invoiceCount} value={String(report.cancellations.invoiceCount)} />
          <Row label={labels.cancelledItems} value={String(report.cancellations.itemCount)} />
          <Row label={labels.total} value={money(report.cancellations.total)} />
        </div>

        {/* By sale type */}
        {report.byOrderType.length > 0 && (
          <>
            <Heading>{labels.byOrderTypeHeading}</Heading>
            <div className="space-y-0.5">
              {report.byOrderType.map((bucket) => (
                <Row
                  key={bucket.orderType}
                  label={`${orderTypeLabel(bucket.orderType)} (${bucket.orderCount})`}
                  value={money(bucket.total)}
                />
              ))}
            </div>
            <div className="mt-1 border-t border-gray-300 pt-1">
              <Row label={labels.total} value={money(report.sales.total)} bold />
            </div>
          </>
        )}

        {/* By guest — absent entirely when no order recorded a pax count */}
        {report.byGuest && (
          <>
            <Heading>{labels.byGuestHeading}</Heading>
            <div className="space-y-0.5">
              <Row label={labels.totalGuests} value={String(report.byGuest.totalGuests)} />
              <Row
                label={labels.invoicesWithGuests}
                value={String(report.byGuest.invoicesWithGuestCount)}
              />
              <Row
                label={labels.averageGuestsPerDay}
                value={report.byGuest.averageGuestsPerDay.toFixed(2)}
              />
              <Row
                label={labels.averageSalesPerGuest}
                value={money(report.byGuest.averageSalesPerGuest)}
              />
            </div>
          </>
        )}

        {/* By payment method */}
        {report.byPaymentMethod.length > 0 && (
          <>
            <Heading>{labels.byPaymentHeading}</Heading>
            <div className="space-y-0.5">
              {report.byPaymentMethod.map((method) => (
                <Row
                  key={method.paymentMethod}
                  label={mapPaymentMethodLabel(t, method.paymentMethod)}
                  value={money(method.revenue)}
                />
              ))}
            </div>
            <div className="mt-1 border-t border-gray-300 pt-1">
              <Row label={labels.total} value={money(report.sales.total)} bold />
            </div>
          </>
        )}

        {/* By product, grouped by menu category */}
        {report.byProduct.categories.length > 0 && (
          <>
            <Heading>{labels.byProductHeading}</Heading>
            <div className="space-y-3">
              {report.byProduct.categories.map((category) => (
                <div key={category.categoryId ?? "none"}>
                  <p className="font-semibold">{category.categoryName}</p>
                  <div className="mt-0.5 space-y-0.5">
                    {category.lines.map((item) => (
                      <Row
                        key={item.name}
                        label={`x${item.quantity} ${item.name}`}
                        value={money(item.gross)}
                      />
                    ))}
                  </div>
                  <div className="mt-0.5 border-t border-gray-200 pt-0.5">
                    <Row
                      label={`${labels.total} (${category.totalQuantity})`}
                      value={money(category.totalGross)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 border-t border-gray-300 pt-1">
              <Row
                label={`${labels.total} (${report.byProduct.totalQuantity})`}
                value={money(report.byProduct.totalGross)}
                bold
              />
            </div>
          </>
        )}

        {/* Cash drawer — session-scoped reports only */}
        {report.cashDrawer && (
          <>
            <Heading>{labels.cashDrawerHeading}</Heading>
            <div className="space-y-0.5">
              <Row label={labels.openingCash} value={money(report.cashDrawer.openingCash)} />
              {report.cashDrawer.expectedCash != null && (
                <Row label={labels.expectedCash} value={money(report.cashDrawer.expectedCash)} />
              )}
              {report.cashDrawer.closingCash != null && (
                <Row label={labels.closingCash} value={money(report.cashDrawer.closingCash)} />
              )}
              {report.cashDrawer.cashDifference != null && (
                <Row
                  label={labels.difference}
                  value={money(report.cashDrawer.cashDifference)}
                  bold
                />
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="my-2 border-t-2 border-gray-400" />
        <div className="space-y-1 text-center text-gray-600">
          <p>
            {labels.printedAt} {dateTime(generatedAt)}
          </p>
          <div className="flex items-center justify-center gap-1.5 text-gray-400">
            <EpidomMark size={14} />
            <p className="text-[11px]">
              {RECEIPT_POWERED_BY_URL} | {RECEIPT_LABELS[receiptLocale].poweredByTitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
