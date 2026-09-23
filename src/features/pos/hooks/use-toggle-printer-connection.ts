"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { PrinterRole } from "@/lib/pwa/printer-connection";
import { usePrinterSettings } from "./use-printer-settings";

/**
 * Connect the printer bound to `role` if it is down, disconnect it if it is up,
 * with the toast for either. Shared by the header popover and the settings
 * dialog so pairing behaves — and reports — identically from both. Every toast
 * names the printer: with four of them, "Connected" alone says nothing.
 */
export function useTogglePrinterConnection(): (role: PrinterRole) => Promise<void> {
  const { t } = useI18n();

  return useCallback(
    async (role: PrinterRole) => {
      const name = t(`pos.printers.roles.${role}.name`);
      const { connected, connect, disconnect } = usePrinterSettings.getState();

      if (connected[role]) {
        disconnect(role);
        toast.success(`${name}: ${t("pos.print.disconnected")}`);
        return;
      }
      const ok = await connect(role);
      if (ok) {
        toast.success(`${name}: ${t("pos.print.connected")}`);
      } else {
        toast.error(t("pos.printers.connectFailed").replace("{printer}", name));
      }
    },
    [t]
  );
}
