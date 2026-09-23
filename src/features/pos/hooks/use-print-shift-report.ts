"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  isBluetoothSupported,
  isPrinterConnected,
  printShiftReport,
  type ShiftReportPrintInput,
} from "@/lib/pwa/thermal-printer";
import { usePrinterSettings } from "./use-printer-settings";

export type PrintShiftReportResult = "printed" | "failed" | "skipped";

/**
 * Prints the shift report on the paired Bluetooth thermal printer, with every
 * toast the cashier needs — the shift-report counterpart of usePrintReceipt.
 *
 * `pairIfNeeded` is the difference between a button and an automatic print:
 *  - true  (a tap): opens the browser's printer picker when nothing is paired.
 *  - false (the end-of-shift auto-print): prints only on a printer that is
 *    already connected and otherwise returns "skipped" without a toast or a
 *    picker — pairing needs a live tap, and a device chooser popping up the
 *    moment a shift ends would surprise a cashier who has no printer at all.
 *
 * Never throws — a printer that is off must not break closing a shift.
 */
export function usePrintShiftReport(): {
  print: (
    input: ShiftReportPrintInput,
    options?: { pairIfNeeded?: boolean }
  ) => Promise<PrintShiftReportResult>;
  isPrinting: boolean;
} {
  const { t } = useI18n();
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback(
    async (input: ShiftReportPrintInput, { pairIfNeeded = true } = {}) => {
      if (!isBluetoothSupported()) {
        if (pairIfNeeded) toast.error(t("pos.print.bluetoothUnsupported"));
        return pairIfNeeded ? "failed" : "skipped";
      }
      if (!pairIfNeeded && !isPrinterConnected()) return "skipped";

      setIsPrinting(true);
      try {
        if (!isPrinterConnected()) {
          // Through the printer-settings store, not connectPrinter() directly,
          // so pairing from here also updates the status bar's printer badge.
          const connected = await usePrinterSettings.getState().connect();
          if (!connected) {
            toast.error(t("pos.print.connectFailed"));
            return "failed";
          }
        }
        await printShiftReport(input);
        toast.success(t("pos.print.success"));
        return "printed";
      } catch (err: unknown) {
        toast.error((err as { message?: string } | null)?.message ?? t("pos.print.failed"));
        return "failed";
      } finally {
        setIsPrinting(false);
      }
    },
    [t]
  );

  return { print, isPrinting };
}
