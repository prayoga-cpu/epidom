"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Printer,
  Bluetooth,
  BluetoothConnected,
  History,
  Loader2,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { useLastReceipt } from "../hooks/use-last-receipt";
import { usePrintReceipt } from "../hooks/use-print-receipt";
import { useTogglePrinterConnection } from "../hooks/use-toggle-printer-connection";
import {
  PRINTER_ROLES,
  isBluetoothSupported,
  type PrinterRole,
} from "@/lib/pwa/printer-connection";
import { PrinterSettingsDialog } from "./printer-settings-dialog";

interface PosPrinterMenuProps {
  storeId: string;
}

/** Header popover: the state of every printer in use on this till with a quick
 * (re)connect for each — pairing never survives a reload, so this is the button
 * a cashier reaches for at the start of a shift — plus auto-print for the
 * receipt, the way into the full printer settings, reprinting the last
 * completed order, and a jump to Order History to reprint an older one. */
export function PosPrinterMenu({ storeId }: PosPrinterMenuProps) {
  const { t } = useI18n();
  const printers = usePrinterSettings((s) => s.printers);
  const connected = usePrinterSettings((s) => s.connected);
  const connecting = usePrinterSettings((s) => s.connecting);
  const setAutoPrint = usePrinterSettings((s) => s.setAutoPrint);
  const toggleConnection = useTogglePrinterConnection();
  const lastReceipt = useLastReceipt((s) => s.receipt);
  const lastReceiptMeta = useLastReceipt((s) => s.meta);
  // Same connect / print / toast behavior as checkout's receipt screen and the
  // cart's Reprint — see usePrintReceipt.
  const { print, isPrinting: isReprinting } = usePrintReceipt();
  const supported = isBluetoothSupported();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The receipt printer is always in play; the others only once switched on.
  const activeRoles = PRINTER_ROLES.filter((role) => role === "MAIN" || printers[role].enabled);
  const connectedCount = activeRoles.filter((role) => connected[role]).length;

  const handleReprintLast = () => {
    if (lastReceipt) void print(lastReceipt);
  };

  const openSettings = () => {
    setMenuOpen(false);
    setSettingsOpen(true);
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // Square like the rest of the top bar's controls, and h-auto (not a fixed
            // h-11) so the bar's default stretch makes it exactly as tall as the bar.
            className="h-auto w-11 shrink-0 rounded-none"
            aria-label={t("pos.print.settingsTitle")}
          >
            {/* Green when every printer in use is up, amber when only some are —
                a dead kitchen printer must not hide behind a healthy receipt one. */}
            <Printer
              className={cn(
                "h-4 w-4",
                connectedCount > 0 &&
                  (connectedCount === activeRoles.length ? "text-emerald-500" : "text-amber-500")
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="space-y-4">
          <p className="text-sm font-semibold">{t("pos.print.settingsTitle")}</p>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("pos.print.autoPrint")}</p>
              <p className="text-muted-foreground text-xs">{t("pos.print.autoPrintDesc")}</p>
            </div>
            <Switch
              checked={printers.MAIN.autoPrint}
              onCheckedChange={(value) => setAutoPrint("MAIN", value)}
            />
          </div>

          {supported ? (
            <ul className="space-y-2 border-t pt-3">
              {activeRoles.map((role) => (
                <PrinterRow
                  key={role}
                  role={role}
                  connected={connected[role]}
                  connecting={connecting === role}
                  disabled={connecting !== null}
                  onToggle={() => void toggleConnection(role)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground border-t pt-3 text-xs">
              {t("pos.print.bluetoothUnsupported")}
            </p>
          )}

          <Button variant="outline" size="sm" className="h-10 w-full gap-2" onClick={openSettings}>
            <Settings2 className="h-3.5 w-3.5" />
            {t("pos.printers.manage")}
          </Button>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("pos.print.reprintLast")}</p>
            {lastReceipt ? (
              <div className="flex items-center justify-between gap-3">
                {lastReceiptMeta ? (
                  <Link
                    href={`/store/${storeId}/pos/orders?tab=history&order=${lastReceiptMeta.orderId}`}
                    className="text-muted-foreground hover:text-foreground truncate font-mono text-xs underline underline-offset-2"
                  >
                    {lastReceipt.orderNumber}
                  </Link>
                ) : (
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {lastReceipt.orderNumber}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 shrink-0 gap-1.5"
                  onClick={handleReprintLast}
                  disabled={isReprinting}
                >
                  {isReprinting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  {t("pos.print.reprint")}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">{t("pos.print.reprintLastEmpty")}</p>
            )}
            {lastReceiptMeta && (
              <Button variant="outline" size="sm" className="h-10 w-full gap-2" asChild>
                <Link
                  href={`/store/${storeId}/pos/orders?tab=history&order=${lastReceiptMeta.orderId}`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t("pos.print.sendLastReceipt")}
                </Link>
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" className="h-10 w-full gap-2" asChild>
            <Link href={`/store/${storeId}/pos/orders?tab=history`}>
              <History className="h-3.5 w-3.5" />
              {t("pos.print.goToOrderHistory")}
            </Link>
          </Button>
        </PopoverContent>
      </Popover>

      <PrinterSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function PrinterRow({
  role,
  connected,
  connecting,
  disabled,
  onToggle,
}: {
  role: PrinterRole;
  connected: boolean;
  /** This row's device picker is open. */
  connecting: boolean;
  /** Some row's picker is open — only one can be at a time. */
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{t(`pos.printers.roles.${role}.name`)}</p>
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <>
              <BluetoothConnected className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                {t("pos.print.connected")}
              </span>
            </>
          ) : (
            <>
              <Bluetooth className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground">{t("pos.print.notConnected")}</span>
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="h-10 shrink-0"
        variant={connected ? "outline" : "default"}
        onClick={onToggle}
        disabled={disabled}
      >
        {connecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : connected ? (
          t("pos.print.disconnect")
        ) : (
          t("pos.printers.connect")
        )}
      </Button>
    </li>
  );
}
