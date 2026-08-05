"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Printer, Bluetooth, BluetoothConnected } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { isBluetoothSupported } from "@/lib/pwa/thermal-printer";
import { toast } from "sonner";

/** Header popover: toggle auto-print on checkout + pair/unpair the Bluetooth thermal printer. */
export function PosPrinterMenu() {
  const { t } = useI18n();
  const { autoPrint, setAutoPrint, connected, isConnecting, connect, disconnect } =
    usePrinterSettings();
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
      </PopoverContent>
    </Popover>
  );
}
