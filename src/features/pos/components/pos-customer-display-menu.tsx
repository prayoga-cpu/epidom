"use client";

import { ExternalLink, Monitor } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCustomerDisplaySettings } from "../hooks/use-customer-display-settings";
import { openCustomerDisplay } from "../lib/open-customer-display";

interface PosCustomerDisplayMenuProps {
  storeId: string;
}

/** Header popover: turn the second, customer-facing screen on or off for this
 * till, and open its window. Off by default — same per-device shape as the
 * printer menu next to it, since whether a customer screen is plugged in is a
 * property of the till, not of the store. */
export function PosCustomerDisplayMenu({ storeId }: PosCustomerDisplayMenuProps) {
  const { t } = useI18n();
  const enabled = useCustomerDisplaySettings((state) => state.enabled);
  const setEnabled = useCustomerDisplaySettings((state) => state.setEnabled);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 touch-manipulation md:h-9 md:w-9"
          aria-label={t("pos.customerDisplay.settingsTitle")}
        >
          <Monitor className={enabled ? "h-4 w-4 text-emerald-500" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <p className="text-sm font-semibold">{t("pos.customerDisplay.settingsTitle")}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("pos.customerDisplay.enable")}</p>
            <p className="text-muted-foreground text-xs">{t("pos.customerDisplay.enableDesc")}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-full touch-manipulation gap-1.5"
            disabled={!enabled}
            onClick={() => openCustomerDisplay(storeId)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("pos.customerDisplay.openWindow")}
          </Button>
          <p className="text-muted-foreground text-xs">
            {enabled
              ? t("pos.customerDisplay.openWindowHint")
              : t("pos.customerDisplay.disabledHint")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
