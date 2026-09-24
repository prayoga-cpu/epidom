"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCustomerDisplaySettings } from "../hooks/use-customer-display-settings";
import { askCustomerForDetails, useCustomerIntake } from "../hooks/use-customer-display";
import { openCustomerDisplay } from "../lib/open-customer-display";

interface PosCustomerDisplayCardProps {
  storeId: string;
  /** A customer is already on the sale: nothing left to ask for. */
  hasCustomer: boolean;
}

/**
 * The customer display, from where the cashier deals with the customer: switch
 * the second screen on (the same per-device setting as the header's monitor
 * menu), open its window, and ask the customer to type their own details on it —
 * their WhatsApp number, then a name and email if they are new. What they type
 * never saves itself: a returning customer is attached by the till's lookup
 * (useCustomerIntakeResolver), and a new one fills the form below for the
 * cashier to save. The status line says which of the two happened.
 */
export function PosCustomerDisplayCard({ storeId, hasCustomer }: PosCustomerDisplayCardProps) {
  const { t } = useI18n();
  const enabled = useCustomerDisplaySettings((state) => state.enabled);
  const setEnabled = useCustomerDisplaySettings((state) => state.setEnabled);
  const phone = useCustomerIntake((state) => state.phone);
  const match = useCustomerIntake((state) => state.match);
  const [asked, setAsked] = useState(false);

  // An answer (or switching the screen off) ends the wait.
  useEffect(() => {
    if (phone || !enabled) setAsked(false);
  }, [phone, enabled]);

  const status = !enabled
    ? null
    : phone
      ? t(
          match === "existing"
            ? "cashierCart.customerDisplay.matched"
            : match === "new"
              ? "cashierCart.customerDisplay.isNew"
              : match === "unknown"
                ? "cashierCart.customerDisplay.unknown"
                : "cashierCart.customerDisplay.checking"
        ).replace("{phone}", phone)
      : asked
        ? t("cashierCart.customerDisplay.waiting")
        : null;

  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="customer-display-card">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="cart-customer-display" className="flex items-center gap-2">
          <Monitor className="h-4 w-4 shrink-0" />
          {t("pos.customerDisplay.enable")}
        </Label>
        <Switch id="cart-customer-display" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <p className="text-muted-foreground text-xs">{t("cashierCart.customerDisplay.details")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {!hasCustomer && (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 touch-manipulation gap-1.5"
            disabled={!enabled}
            onClick={() => {
              askCustomerForDetails(storeId);
              setAsked(true);
            }}
          >
            <Smartphone className="h-4 w-4" />
            {t("cashierCart.customerDisplay.ask")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 touch-manipulation gap-1.5"
          disabled={!enabled}
          onClick={() => openCustomerDisplay(storeId)}
        >
          <ExternalLink className="h-4 w-4" />
          {t("pos.customerDisplay.openWindow")}
        </Button>
      </div>
      {status && (
        <p role="status" className="text-primary text-xs font-medium">
          {status}
        </p>
      )}
      {!enabled && (
        <p className="text-muted-foreground text-xs">{t("pos.customerDisplay.disabledHint")}</p>
      )}
    </div>
  );
}
