"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCustomerDisplaySettings } from "../hooks/use-customer-display-settings";
import {
  askCustomerForDetails,
  useCustomerIntake,
  type CustomerAutoSave,
} from "../hooks/use-customer-display";
import type { CustomerDisplayMatch } from "../lib/customer-display";
import { openCustomerDisplay } from "../lib/open-customer-display";

interface PosCustomerDisplayCardProps {
  storeId: string;
  /** A customer is already on the sale: nothing left to ask for. */
  hasCustomer: boolean;
}

/** The status line's message for where the customer's number has got to. */
function statusKey(
  match: CustomerDisplayMatch | null,
  autoSave: CustomerAutoSave,
  takenOver: boolean
): string {
  if (autoSave === "saving") return "cashierCart.customerDisplay.saving";
  if (autoSave === "saved") return "cashierCart.customerDisplay.saved";
  if (autoSave === "failed") return "cashierCart.customerDisplay.saveFailed";
  if (match === "existing") return "cashierCart.customerDisplay.matched";
  if (match === "new") {
    return takenOver
      ? "cashierCart.customerDisplay.isNewManual"
      : "cashierCart.customerDisplay.isNew";
  }
  if (match === "unknown") return "cashierCart.customerDisplay.unknown";
  return "cashierCart.customerDisplay.checking";
}

/**
 * The customer display, from where the cashier deals with the customer: switch
 * the second screen on (the same per-device setting as the header's monitor
 * menu), open its window, and ask the customer to type their own details on it —
 * their WhatsApp number, then a name and email if they are new. The till acts on
 * it (useCustomerIntakeResolver): a returning customer is attached by the
 * lookup, and a new one is saved and attached once they press Done — unless the
 * cashier took the form below over, in which case it is theirs to save. The
 * status line says which of these happened.
 */
export function PosCustomerDisplayCard({ storeId, hasCustomer }: PosCustomerDisplayCardProps) {
  const { t } = useI18n();
  const enabled = useCustomerDisplaySettings((state) => state.enabled);
  const setEnabled = useCustomerDisplaySettings((state) => state.setEnabled);
  const phone = useCustomerIntake((state) => state.phone);
  const match = useCustomerIntake((state) => state.match);
  const autoSave = useCustomerIntake((state) => state.autoSave);
  const takenOver = useCustomerIntake(
    (state) => state.receivedAt > 0 && state.takenOverFor === state.receivedAt
  );
  const [asked, setAsked] = useState(false);

  // An answer (or switching the screen off) ends the wait.
  useEffect(() => {
    if (phone || !enabled) setAsked(false);
  }, [phone, enabled]);

  const status = !enabled
    ? null
    : phone
      ? t(statusKey(match, autoSave, takenOver)).replace("{phone}", phone)
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
