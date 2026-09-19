"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/shared/decimal-input";
import { usePosModeUpgradeGate } from "@/features/pos-mode/pos-mode-upgrade-banner";
import { useOnlineStatus } from "@/hooks/use-network-status";
import { FEATURE_MIN_PLAN, planAtLeast } from "@/lib/plans/entitlements";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";
import type { DiscountPresetDto } from "@/types/api/cashier";
import { usePosCart } from "../hooks/use-pos-cart";
import { useDiscountPresets } from "../hooks/use-discount-presets";
import { itemsTotalOf } from "../lib/cart-format";

const REASON_MAX = 200;

interface PosDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

/**
 * The bill's one "primary" discount: a preset (one tap) or a manual amount +
 * reason. Manual, preset and coupon are mutually exclusive — whichever is set
 * last wins, and the cart says so by simply replacing the source.
 *
 * Presets are an OPERATIONS feature and online-only: below the plan or offline
 * the section is left out entirely and the manual form (today's behaviour)
 * carries on alone, rather than showing an empty or failing list.
 *
 * Every amount is literal in the store's display currency — a FIXED preset of 5
 * in a EUR store is 5 EUR — so it is formatted with `currency` passed as the
 * source currency (which disables the IDR base conversion), and the manual
 * input shows `getCurrencySymbol(currency)`.
 */
export function PosDiscountDialog({ open, onOpenChange, storeId }: PosDiscountDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const online = useOnlineStatus();
  const { currentPlan } = usePosModeUpgradeGate();

  const discountSource = usePosCart((s) => s.discountSource);
  const items = usePosCart((s) => s.items);
  const setDiscount = usePosCart((s) => s.setDiscount);
  const setDiscountSource = usePosCart((s) => s.setDiscountSource);

  const presetsAllowed = planAtLeast(currentPlan, FEATURE_MIN_PLAN.loyaltyAndPromotions) && online;
  const { data: presets } = useDiscountPresets(storeId, open && presetsAllowed);
  const activePresets = (presets ?? []).filter((p) => p.isActive);

  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState("");

  // Every open re-seeds the manual form from the live discount, so reopening
  // to tweak "10.00 — Regular" shows exactly that, and a preset/coupon (which
  // has no manual amount) starts the form blank.
  useEffect(() => {
    if (!open) return;
    if (discountSource?.kind === "manual") {
      setAmount(discountSource.amount);
      setReason(discountSource.reason ?? "");
    } else {
      setAmount(undefined);
      setReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const itemsTotal = itemsTotalOf(items);
  const canApply = amount !== undefined && amount > 0;
  const overBill = canApply && amount! > itemsTotal;

  const applyPreset = (preset: DiscountPresetDto) => {
    setDiscountSource({
      kind: "preset",
      presetId: preset.id,
      name: preset.name,
      type: preset.type,
      value: preset.value,
    });
    onOpenChange(false);
  };

  const applyManual = () => {
    if (!canApply) return;
    setDiscount(amount as number, reason.trim() || undefined);
    onOpenChange(false);
  };

  const remove = () => {
    setDiscountSource(null);
    onOpenChange(false);
  };

  const presetValueLabel = (preset: DiscountPresetDto) =>
    preset.type === "PERCENT" ? `${preset.value}%` : formatPrice(preset.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.discountDialog.title")}
        maxWidth="sm"
        footer={
          <>
            {discountSource && (
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
              {t("common.actions.close")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {activePresets.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("cashierCart.discountDialog.presets")}</h3>
              <div className="grid grid-cols-2 gap-2">
                {activePresets.map((preset) => {
                  const selected =
                    discountSource?.kind === "preset" && discountSource.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "flex min-h-14 touch-manipulation flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors",
                        selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                      )}
                    >
                      <span className="text-base leading-tight font-semibold tabular-nums">
                        {presetValueLabel(preset)}
                      </span>
                      <span className="text-muted-foreground w-full truncate text-xs">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("cashierCart.discountDialog.manual")}</h3>
            <div className="space-y-1.5">
              <Label htmlFor="pos-discount-amount">{t("pos.cart.discountAmount")}</Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  {getCurrencySymbol(currency)}
                </span>
                <DecimalInput
                  id="pos-discount-amount"
                  decimals={2}
                  min={0}
                  placeholder="0"
                  className="h-11 pl-8 text-base font-medium"
                  value={amount}
                  onChange={setAmount}
                />
              </div>
              {overBill && (
                <p className="text-muted-foreground text-xs">
                  {t("cashierCart.discountDialog.cappedHint")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-discount-reason">{t("pos.cart.discountReason")}</Label>
              <Input
                id="pos-discount-reason"
                className="h-11"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX}
              />
            </div>
            <Button
              type="button"
              className="h-11 w-full touch-manipulation"
              disabled={!canApply}
              onClick={applyManual}
            >
              {t("common.actions.apply")}
            </Button>
          </section>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
