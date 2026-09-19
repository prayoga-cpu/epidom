"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  isBluetoothSupported,
  isPrinterConnected,
  printReceipt,
  type ReceiptData,
} from "@/lib/pwa/thermal-printer";
import { usePrinterSettings } from "./use-printer-settings";

/**
 * Prints a receipt (or a provisional bill — same ReceiptData) on the paired
 * Bluetooth thermal printer, with every toast the cashier needs: unsupported
 * browser, pairing failed, printed, print failed.
 *
 * Extracted from checkout's inline handler so the order-complete screen and the
 * cart's Reprint / Print Bill all behave identically. Never throws — a printer
 * that is off must not break the sale that just went through.
 */
export function usePrintReceipt(): {
  print: (receipt: ReceiptData) => Promise<void>;
  isPrinting: boolean;
} {
  const { t } = useI18n();
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback(
    async (receipt: ReceiptData) => {
      if (!isBluetoothSupported()) {
        toast.error(t("pos.print.bluetoothUnsupported"));
        return;
      }
      setIsPrinting(true);
      try {
        if (!isPrinterConnected()) {
          // Routed through the printer-settings store (not connectPrinter()
          // directly) so a pairing done from here also updates the header's
          // connected badge — otherwise that badge would stay stuck on "Not
          // connected" until the cashier happened to open it. Pairing needs a
          // live tap (Web Bluetooth's requestDevice requires user activation),
          // so callers must invoke print() from a click, not from an effect.
          const connected = await usePrinterSettings.getState().connect();
          if (!connected) {
            toast.error(t("pos.print.connectFailed"));
            return;
          }
        }
        await printReceipt(receipt);
        toast.success(t("pos.print.success"));
      } catch (err: unknown) {
        toast.error((err as { message?: string } | null)?.message ?? t("pos.print.failed"));
      } finally {
        setIsPrinting(false);
      }
    },
    [t]
  );

  return { print, isPrinting };
}
