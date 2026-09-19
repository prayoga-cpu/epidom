"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkRedeem,
  maxRedeemablePoints,
  pointsToValue,
  type RedeemRejection,
} from "@/lib/finance/discounts";
import { usePosCart } from "../hooks/use-pos-cart";
import { itemsTotalOf } from "../lib/cart-format";

interface PosRedeemPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The share of the maximum each quick button fills in (the "Max" button is separate: it takes all of it). */
const QUICK_SHARES = [
  { key: "quarter", share: 0.25, label: "25%" },
  { key: "half", share: 0.5, label: "50%" },
] as const;

/**
 * Burn some of the attached customer's loyalty points against this bill.
 *
 * Bounded by the customer's balance AND by what is still payable (a redemption
 * never pays for more than the bill, after any preset/coupon/manual discount),
 * and validated with the SAME `checkRedeem` the server re-runs — so a number
 * this dialog accepts is one the order will accept.
 *
 * Point values are literal amounts in the store's display currency (never
 * IDR-converted), which is why money here is formatted with `currency` passed
 * as the source currency.
 */
export function PosRedeemPointsDialog({ open, onOpenChange }: PosRedeemPointsDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const customer = usePosCart((s) => s.customer);
  const rules = usePosCart((s) => s.loyaltyRules);
  const items = usePosCart((s) => s.items);
  const primaryDiscount = usePosCart((s) => s.primaryDiscountAmount);
  const redeemPoints = usePosCart((s) => s.redeemPoints);
  const setRedeemPoints = usePosCart((s) => s.setRedeemPoints);

  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (open) setPoints(redeemPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Nothing to redeem against: the More tile is disabled in these states, so
  // this only guards a stale dialog (customer detached while it was open).
  if (!customer || !rules) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <FormDialogLayout
          title={t("cashierCart.pointsDialog.title")}
          maxWidth="sm"
          footer={
            <Button
              type="button"
              variant="outline"
              className="h-11 touch-manipulation"
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.close")}
            </Button>
          }
        >
          <p className="text-muted-foreground text-sm">{t("cashierCart.more.hintNeedsCustomer")}</p>
        </FormDialogLayout>
      </Dialog>
    );
  }

  const payable = Math.round((itemsTotalOf(items) - primaryDiscount) * 100) / 100;
  const max = maxRedeemablePoints({ balance: customer.points, payable, rules });
  const rejection: RedeemRejection | null =
    points > 0 ? checkRedeem({ points, balance: customer.points, payable, rules }) : null;
  const valid = points > 0 && rejection === null;
  // A share of the maximum must still clear the store's minimum redemption.
  const lowest = Math.max(rules.minRedeemPoints, 1);

  const rejectionMessage = (reason: RedeemRejection) =>
    t(`cashierCart.pointsDialog.reason.${reason}`).replace(
      "{min}",
      String(Math.max(rules.minRedeemPoints, 1))
    );

  const apply = () => {
    if (!valid) return;
    setRedeemPoints(points);
    onOpenChange(false);
  };

  const remove = () => {
    setRedeemPoints(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.pointsDialog.title")}
        maxWidth="sm"
        footer={
          <>
            {redeemPoints > 0 && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11 touch-manipulation"
                onClick={remove}
              >
                {t("common.actions.remove")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 touch-manipulation"
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 touch-manipulation"
              disabled={!valid}
              onClick={apply}
            >
              {t("common.actions.apply")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted/40 space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{customer.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {t("cashierCart.pointsDialog.balance").replace("{count}", String(customer.points))}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("cashierCart.pointsDialog.pointValue").replace(
                "{value}",
                formatPrice(rules.pointValue)
              )}
            </p>
          </div>

          {max === 0 ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t("cashierCart.pointsDialog.nothingToRedeem").replace(
                "{min}",
                String(Math.max(rules.minRedeemPoints, 1))
              )}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                {QUICK_SHARES.map(({ key, share, label }) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 touch-manipulation"
                    onClick={() =>
                      setPoints(Math.min(max, Math.max(Math.floor(max * share), lowest)))
                    }
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 touch-manipulation"
                  onClick={() => setPoints(max)}
                >
                  {t("cashierCart.pointsDialog.max")}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pos-redeem-points">
                  {t("cashierCart.pointsDialog.pointsToRedeem")}
                </Label>
                <Input
                  id="pos-redeem-points"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 text-base font-medium tabular-nums"
                  value={points > 0 ? String(points) : ""}
                  placeholder="0"
                  onChange={(e) => setPoints(Number(e.target.value.replace(/\D/g, "")) || 0)}
                />
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t("cashierCart.pointsDialog.upTo").replace("{count}", String(max))}
                  </span>
                  {points > 0 && (
                    <span className="font-medium tabular-nums">
                      -{formatPrice(pointsToValue(points, rules.pointValue))}
                    </span>
                  )}
                </div>
                {rejection && (
                  <p role="alert" className="text-destructive text-sm font-medium">
                    {rejectionMessage(rejection)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
