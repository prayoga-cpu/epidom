"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { printItemLabels, type LabelPrinterConfig } from "@/lib/pwa/item-label";
import { printOrderTicket } from "@/lib/pwa/order-ticket";
import {
  PrinterNotConnectedError,
  PrinterTimeoutError,
  isBluetoothSupported,
  isPrinterConnected,
  type PrinterRole,
} from "@/lib/pwa/printer-connection";
import {
  cartLineToPrepLine,
  indexMenuDepartments,
  isEmptyPlan,
  planOrderPrint,
  type OrderPrintContext,
  type OrderPrintPlan,
  type OrderPrintRoles,
} from "../lib/print-plan";
import type { CartItem, PosMenuCategory } from "../types/pos.types";
import { usePrinterSettings } from "./use-printer-settings";

/** An order as the tickets and labels need it: who/where/when, plus the cart lines as they were rung up. */
export interface OrderPrintInput {
  context: OrderPrintContext;
  items: CartItem[];
}

/**
 * The printers set up on this device and which of them print in this run. `auto`
 * is "an order was just placed": only printers set to print by themselves.
 * `manual` is a cashier tapping Print: every printer that is set up. Whether a
 * printer is SET UP (routing) is deliberately reported apart from whether it
 * PRINTS NOW — see OrderPrintRoles.
 */
export function orderPrintRoles(mode: "auto" | "manual"): OrderPrintRoles {
  const { printers, label } = usePrinterSettings.getState();
  const prints = (role: "KITCHEN" | "BAR" | "LABEL") =>
    printers[role].enabled && (mode === "manual" || printers[role].autoPrint);
  return {
    KITCHEN: {
      enabled: printers.KITCHEN.enabled,
      print: prints("KITCHEN"),
      paperWidth: printers.KITCHEN.paperWidth,
    },
    BAR: {
      enabled: printers.BAR.enabled,
      print: prints("BAR"),
      paperWidth: printers.BAR.paperWidth,
    },
    LABEL: { enabled: printers.LABEL.enabled, print: prints("LABEL"), scope: label.scope },
  };
}

/** True when ANY of the kitchen / bar / label printers is set up on this device. */
export function useHasOrderPrinters(): boolean {
  return usePrinterSettings(
    (s) => s.printers.KITCHEN.enabled || s.printers.BAR.enabled || s.printers.LABEL.enabled
  );
}

function labelConfig(): LabelPrinterConfig {
  const { printers, label } = usePrinterSettings.getState();
  return {
    language: label.language,
    paperWidth: printers.LABEL.paperWidth,
    widthMm: label.widthMm,
    heightMm: label.heightMm,
    gapMm: label.gapMm,
  };
}

const onlyRoles = (plan: OrderPrintPlan, roles: PrinterRole[]): OrderPrintPlan => ({
  tickets: plan.tickets.filter((planned) => roles.includes(planned.role)),
  labels: roles.includes("LABEL") ? plan.labels : [],
});

/**
 * Prints an order's kitchen / bar tickets and item labels on the printers set up
 * for them — the sibling of usePrintReceipt for everything that is NOT the
 * customer's receipt. Never throws: a printer that is off must not break the
 * sale that just went through.
 *
 * Two ways in, because pairing needs a live tap (Web Bluetooth's requestDevice
 * requires user activation):
 *  - `interactive: false` — an order was just placed. Prints only on printers
 *    already connected and never opens a picker. A printer that should have
 *    printed but isn't connected is NOT silent: a warning toast says so and its
 *    "Connect & print" button (a fresh tap) finishes the job. Success is silent —
 *    the paper coming out is the confirmation.
 *  - `interactive: true` — a cashier tapped Print. May pair a printer first,
 *    and confirms with a toast.
 */
export function usePrintOrder(storeId: string): {
  printOrder: (input: OrderPrintInput, options: { interactive: boolean }) => Promise<void>;
  isPrinting: boolean;
} {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [isPrinting, setIsPrinting] = useState(false);

  const roleName = useCallback((role: PrinterRole) => t(`pos.printers.roles.${role}.name`), [t]);
  const nameList = useCallback(
    (roles: PrinterRole[]) => roles.map(roleName).join(", "),
    [roleName]
  );

  const run = useCallback(
    async (plan: OrderPrintPlan, interactive: boolean): Promise<void> => {
      if (isEmptyPlan(plan)) return;
      if (!isBluetoothSupported()) {
        if (interactive) toast.error(t("pos.print.bluetoothUnsupported"));
        return;
      }

      const jobs: Array<{ role: PrinterRole; send: () => Promise<void> }> = [
        ...plan.tickets.map(({ role, ticket }) => ({
          role: role as PrinterRole,
          send: () => printOrderTicket(role, ticket),
        })),
        ...(plan.labels.length > 0
          ? [
              {
                role: "LABEL" as PrinterRole,
                send: () => printItemLabels(plan.labels, labelConfig()),
              },
            ]
          : []),
      ];

      const done: PrinterRole[] = [];
      const missed: PrinterRole[] = [];
      const failed: Array<{ role: PrinterRole; message: string }> = [];
      const ready: typeof jobs = [];
      // A device picker consumes the tap that opened it, so only one printer can
      // be paired per tap; any other disconnected one is reported, not chased.
      let prompted = false;

      setIsPrinting(true);
      try {
        // Pass 1 — pairing, BEFORE any bytes are sent. requestDevice needs the
        // tap's transient user activation (about five seconds in Chrome); sending
        // a label batch or two tickets first can use that up, and the picker then
        // fails for a tap the cashier really made.
        for (const job of jobs) {
          if (isPrinterConnected(job.role)) {
            ready.push(job);
            continue;
          }
          if (!interactive || prompted) {
            missed.push(job.role);
            continue;
          }
          prompted = true;
          if (await usePrinterSettings.getState().connect(job.role)) {
            ready.push(job);
          } else {
            failed.push({
              role: job.role,
              message: t("pos.printers.connectFailed").replace("{printer}", roleName(job.role)),
            });
          }
        }

        // Pass 2 — sending.
        for (const job of ready) {
          try {
            await job.send();
            done.push(job.role);
          } catch (err: unknown) {
            failed.push({
              role: job.role,
              message:
                err instanceof PrinterNotConnectedError
                  ? t("pos.printers.notConnected").replace("{printer}", roleName(job.role))
                  : err instanceof PrinterTimeoutError
                    ? t("pos.printers.notResponding").replace("{printer}", roleName(job.role))
                    : ((err as { message?: string } | null)?.message ?? t("pos.print.failed")),
            });
          }
        }
      } finally {
        setIsPrinting(false);
      }

      if (interactive && done.length > 0) {
        toast.success(t("pos.printers.sent").replace("{printers}", nameList(done)));
      }
      // A failure is as actionable as a miss: the ticket that didn't come out is
      // still owed to the kitchen, and the tap that retries it can also re-pair.
      for (const { role, message } of failed) {
        toast.error(`${roleName(role)}: ${message}`, {
          duration: 20_000,
          action: {
            label: t("pos.printers.retry"),
            onClick: () => void run(onlyRoles(plan, [role]), true),
          },
        });
      }
      if (missed.length > 0) {
        toast.warning(t("pos.printers.notPrinted").replace("{printers}", nameList(missed)), {
          duration: 20_000,
          action: {
            label: t("pos.printers.connectAndPrint"),
            // A fresh tap, so the device picker is allowed to open.
            onClick: () => void run(onlyRoles(plan, missed), true),
          },
        });
      }
    },
    [t, roleName, nameList]
  );

  const printOrder = useCallback(
    async (input: OrderPrintInput, options: { interactive: boolean }): Promise<void> => {
      // Everything here, planning included, runs inside the checkout's success
      // path — a throw would skip the order-complete screen for a sale that has
      // already gone through. So nothing escapes: a bad line is logged, and only
      // a cashier who tapped Print is told.
      try {
        // A cart line doesn't carry which prep area it belongs to, so it is looked
        // up in the POS menu the shell already keeps cached (offline too). A cold
        // cache degrades to the kitchen — the KDS's own default — rather than
        // dropping a line.
        const menu = indexMenuDepartments(
          queryClient.getQueryData<{ categories: PosMenuCategory[] }>(["pos", "menu", storeId])
            ?.categories
        );
        const source = {
          context: input.context,
          lines: input.items.map((item) => cartLineToPrepLine(item, menu)),
        };
        await run(
          planOrderPrint(source, orderPrintRoles(options.interactive ? "manual" : "auto")),
          options.interactive
        );
      } catch (err: unknown) {
        console.error("[usePrintOrder]", err);
        if (options.interactive) toast.error(t("pos.print.failed"));
      }
    },
    [run, queryClient, storeId, t]
  );

  return { printOrder, isPrinting };
}
