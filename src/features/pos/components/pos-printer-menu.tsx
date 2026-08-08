"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Printer, Bluetooth, BluetoothConnected, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { useLastReceipt } from "../hooks/use-last-receipt";
import { isBluetoothSupported, isPrinterConnected, printReceipt } from "@/lib/pwa/thermal-printer";
import { toast } from "sonner";

interface PosPrinterMenuProps {
  storeId: string;
}

/** Header popover: toggle auto-print on checkout, pair/unpair the Bluetooth
 * thermal printer, reprint the last completed order, and jump to Order
 * History to reprint an older one. */
export function PosPrinterMenu({ storeId }: PosPrinterMenuProps) {
  const { t } = useI18n();
  const {
    autoPrint,
    setAutoPrint,
    paperWidth,
    setPaperWidth,
    connected,
    isConnecting,
    connect,
    disconnect,
  } = usePrinterSettings();
  const lastReceipt = useLastReceipt((s) => s.receipt);
  const [isReprinting, setIsReprinting] = useState(false);
  const supported = isBluetoothSupported();

  const handleConnectToggle = async () => {
    if (connected) {
      disconnect();
      toast.success(t("pos.print.disconnected"));
      return;
    }
    const ok = await connect();
    if (ok) {
      toast.success(t("pos.print.connected"));
    } else {
      toast.error(t("pos.print.connectFailed"));
    }
  };

  const handleReprintLast = async () => {
    if (!lastReceipt) return;
    if (!isBluetoothSupported()) {
      toast.error(t("pos.print.bluetoothUnsupported"));
      return;
    }
    setIsReprinting(true);
    try {
      if (!isPrinterConnected()) {
        const ok = await usePrinterSettings.getState().connect();
        if (!ok) {
          toast.error(t("pos.print.connectFailed"));
          return;
        }
      }
      await printReceipt(lastReceipt);
      toast.success(t("pos.print.success"));
    } catch (err: any) {
      toast.error(err?.message ?? t("pos.print.failed"));
    } finally {
      setIsReprinting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t("pos.print.settingsTitle")}
        >
          <Printer className={connected ? "h-4 w-4 text-emerald-500" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="space-y-4">
        <p className="text-sm font-semibold">{t("pos.print.settingsTitle")}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("pos.print.autoPrint")}</p>
            <p className="text-muted-foreground text-xs">{t("pos.print.autoPrintDesc")}</p>
          </div>
          <Switch checked={autoPrint} onCheckedChange={setAutoPrint} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-sm font-medium">{t("pos.print.paperWidth")}</p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={paperWidth === 32 ? "default" : "outline"}
              onClick={() => setPaperWidth(32)}
              className="h-8 px-3"
            >
              {t("pos.print.paperWidth58")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={paperWidth === 48 ? "default" : "outline"}
              onClick={() => setPaperWidth(48)}
              className="h-8 px-3"
            >
              {t("pos.print.paperWidth80")}
            </Button>
          </div>
        </div>

        {supported ? (
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs">
              {connected ? (
                <>
                  <BluetoothConnected className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("pos.print.connected")}
                  </span>
                </>
              ) : (
                <>
                  <Bluetooth className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground">{t("pos.print.notConnected")}</span>
                </>
              )}
            </div>
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              onClick={handleConnectToggle}
              disabled={isConnecting}
            >
              {isConnecting
                ? t("pos.print.connecting")
                : connected
                  ? t("pos.print.disconnect")
                  : t("pos.print.connect")}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            {t("pos.print.bluetoothUnsupported")}
          </p>
        )}

        <Separator />

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("pos.print.reprintLast")}</p>
          {lastReceipt ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground truncate font-mono text-xs">
                {lastReceipt.orderNumber}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
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
        </div>

        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href={`/store/${storeId}/pos/orders?tab=history`}>
            <History className="h-3.5 w-3.5" />
            {t("pos.print.goToOrderHistory")}
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
