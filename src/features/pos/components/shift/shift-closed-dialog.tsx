"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { useI18n } from "@/components/lang/i18n-provider";
import { isBluetoothSupported } from "@/lib/pwa/thermal-printer";
import { shiftReportPath } from "@/lib/finance/shift-report-path";
import { resolveReceiptLocale } from "@/lib/receipts/receipt-labels";
import { useShiftReport, type ShiftReportResponse } from "../../hooks/use-active-shift";
import {
  usePrintShiftReport,
  type PrintShiftReportResult,
} from "../../hooks/use-print-shift-report";
import { usePrinterSettings } from "../../hooks/use-printer-settings";
import { ShiftReportDocument } from "../shift-report-print-view";

/** What the page remembers about a shift it has just closed. */
export interface EndedShift {
  shiftId: string;
  staffName: string | null;
}

interface ShiftClosedDialogProps {
  storeId: string;
  ended: EndedShift;
  onDone: () => void;
}

/**
 * After "End shift": the shift's report, in three forms — printed on the
 * receipt printer, previewed here, and reachable by link.
 *
 * The print happens by itself when a receipt printer is already connected;
 * otherwise nothing pops up (pairing needs a live tap, and a device chooser
 * appearing the instant a shift ends would surprise a cashier with no printer)
 * and the Print button is the way in. The preview and link stay either way,
 * so the report is never lost to a printer that is off.
 *
 * Mount it keyed on the shift id — the auto-print guard is per instance.
 */
export function ShiftClosedDialog({ storeId, ended, onDone }: ShiftClosedDialogProps) {
  const { t, locale } = useI18n();
  // The shift report always prints on the till's own (MAIN) receipt printer.
  const paperWidth = usePrinterSettings((s) => s.printers.MAIN.paperWidth);
  const { print, isPrinting } = usePrintShiftReport();
  const report = useShiftReport(storeId, ended.shiftId);
  const data = report.data;

  // Fixed for this dialog's lifetime, so the preview and the paper both say
  // when the report was produced, not when it was last re-rendered.
  const [generatedAt] = useState(() => new Date());
  const [printResult, setPrintResult] = useState<PrintShiftReportResult | null>(null);
  const autoPrinted = useRef(false);

  const toPrintInput = (response: ShiftReportResponse) => ({
    report: response.report,
    storeName: response.storeName,
    currency: response.currency,
    locale: resolveReceiptLocale(locale),
    width: paperWidth,
    shiftLabel: response.shiftLabel,
    generatedAt,
  });

  useEffect(() => {
    if (!data || autoPrinted.current) return;
    autoPrinted.current = true;
    void print(toPrintInput(data), { pairIfNeeded: false }).then(setPrintResult);
    // toPrintInput closes over values that don't change once the report is in;
    // the ref above is what guarantees this runs exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const reportPath = (autoPrint: boolean) =>
    shiftReportPath(storeId, ended.shiftId, { print: autoPrint });

  const handlePrint = async () => {
    if (!data) return;
    if (!isBluetoothSupported()) {
      // iPad Safari has no Web Bluetooth. The report page prints through the
      // browser's own dialog (AirPrint and friends) — the same document.
      window.open(reportPath(true), "_blank");
      return;
    }
    setPrintResult(await print(toPrintInput(data), { pairIfNeeded: true }));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${reportPath(false)}`);
      toast.success(t("pos.shift.linkCopied"));
    } catch {
      toast.error(t("pos.shift.copyFailed"));
    }
  };

  const name = data?.shiftLabel ?? ended.staffName;

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <FormDialogLayout
        maxWidth="md"
        title={t("pos.shift.closedTitle")}
        description={name ? t("pos.shift.closedDesc").replace("{name}", name) : undefined}
        footer={
          // Wraps instead of holding one row: four nowrap buttons together are wider
          // than this dialog once a label runs longer than English's, and a
          // non-wrapping justify-end row spills off its LEFT edge — that is what
          // cropped Print. flex-1 (never w-full, AGENTS.md) lets the text buttons
          // share a wrapped row; sm: keeps them at natural width, right-aligned.
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              type="button"
              className="h-11 flex-1 sm:flex-none"
              onClick={handlePrint}
              disabled={!data || isPrinting}
            >
              {isPrinting ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Printer className="mr-2 size-4" aria-hidden />
              )}
              {t("pos.shift.printReport")}
            </Button>
            {/* Icon only — the name lives in aria-label. 44px square: the touch floor. */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={t("pos.shift.copyLink")}
              onClick={handleCopyLink}
            >
              <Copy className="size-4" aria-hidden />
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1 sm:flex-none">
              <a href={reportPath(false)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" aria-hidden />
                {t("pos.shift.openReport")}
              </a>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 flex-1 sm:flex-none"
              onClick={onDone}
            >
              {t("pos.shift.done")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {printResult === "printed" && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              {t("pos.shift.printedAuto")}
            </p>
          )}
          {printResult === "skipped" && isBluetoothSupported() && (
            <p role="status" className="text-muted-foreground text-sm">
              {t("pos.shift.printNeedsPrinter")}
            </p>
          )}

          {/* dvh, capped for the app's CSS zoom — a vh-sized panel can render
              taller than the visible viewport on iOS and push the footer away. */}
          <div className="bg-muted/40 max-h-[calc(50dvh/var(--app-zoom,1))] overflow-y-auto rounded-lg border p-3">
            {report.isLoading ? (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {t("pos.shift.previewLoading")}
              </p>
            ) : data ? (
              <ShiftReportDocument
                report={data.report}
                storeName={data.storeName}
                currency={data.currency}
                shiftLabel={data.shiftLabel}
                generatedAt={generatedAt.toISOString()}
              />
            ) : (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {t("pos.shift.previewFailed")}
              </p>
            )}
          </div>

          <p className="text-muted-foreground text-xs">{t("pos.shift.linkHint")}</p>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
