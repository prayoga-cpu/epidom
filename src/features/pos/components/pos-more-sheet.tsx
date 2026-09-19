"use client";

import {
  Combine,
  Lock,
  PenLine,
  Printer,
  Split,
  Star,
  Tag,
  Ticket,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { usePosModeUpgradeGate } from "@/features/pos-mode/pos-mode-upgrade-banner";
import { FEATURE_MIN_PLAN, planAtLeast, type PlanTier } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";

export type MoreAction =
  | "customItem"
  | "splitBill"
  | "mergeBill"
  | "discount"
  | "coupon"
  | "redeemPoints"
  | "reprintLast"
  | "clear";

interface PosMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired AFTER the sheet has closed and any plan gate has passed. */
  onAction: (action: MoreAction) => void;
  /** Coupons, points, merge and customer features are online-only. */
  online: boolean;
  hasItems: boolean;
  hasCustomer: boolean;
  loyaltyEnabled: boolean;
  /** Saved bills only exist while the Active Queue is on. */
  activeQueueEnabled: boolean;
  canReprint: boolean;
  canClear: boolean;
}

interface Tile {
  action: MoreAction;
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  hint?: string;
  /** Below the plan: stays tappable so the upgrade banner can explain itself. */
  locked: boolean;
  gate?: { plan: PlanTier; label: string };
}

/**
 * The "More ⋯" grid: ≥56px tiles for everything that doesn't earn a slot in
 * the always-visible quick row.
 *
 * Three kinds of "not right now", deliberately shown differently:
 *  - plan-locked (Discount / Coupon / Redeem Points below their tier): the tile
 *    stays ENABLED with a lock badge — tapping it closes the sheet and raises
 *    the upgrade banner (rendered above the register, hidden by this sheet's
 *    overlay if it stayed open);
 *  - offline / missing prerequisite: the tile is DISABLED with a one-line hint
 *    saying what it needs, so the cashier never has to guess why it is grey;
 *  - available: plain.
 *
 * The manual amount discount keeps its own `discounts` gate; coupons, points
 * and presets share the newer `loyaltyAndPromotions` one, which the server
 * enforces too.
 */
export function PosMoreSheet({
  open,
  onOpenChange,
  onAction,
  online,
  hasItems,
  hasCustomer,
  loyaltyEnabled,
  activeQueueEnabled,
  canReprint,
  canClear,
}: PosMoreSheetProps) {
  const { t } = useI18n();
  const { currentPlan, requireFeature } = usePosModeUpgradeGate();

  const discountLocked = !planAtLeast(currentPlan, FEATURE_MIN_PLAN.discounts);
  const promoLocked = !planAtLeast(currentPlan, FEATURE_MIN_PLAN.loyaltyAndPromotions);

  const needsConnection = t("cashierCart.more.hintNeedsConnection");
  const addItems = t("cashierCart.more.hintAddItems");

  const tiles: Tile[] = [
    {
      action: "customItem",
      icon: PenLine,
      label: t("cashierCart.more.customItem"),
      disabled: false,
      locked: false,
    },
    {
      action: "splitBill",
      icon: Split,
      label: t("cashierCart.more.splitBill"),
      disabled: !hasItems,
      hint: hasItems ? undefined : addItems,
      locked: false,
    },
    {
      action: "mergeBill",
      icon: Combine,
      label: t("cashierCart.more.mergeBill"),
      disabled: !online || !activeQueueEnabled,
      hint: !online
        ? needsConnection
        : !activeQueueEnabled
          ? t("cashierCart.more.hintQueueOff")
          : undefined,
      locked: false,
    },
    {
      action: "discount",
      icon: Tag,
      label: t("cashierCart.more.discount"),
      disabled: !discountLocked && !hasItems,
      hint: !discountLocked && !hasItems ? addItems : undefined,
      locked: discountLocked,
      gate: { plan: FEATURE_MIN_PLAN.discounts, label: t("cashierCart.more.lockedDiscount") },
    },
    {
      action: "coupon",
      icon: Ticket,
      label: t("cashierCart.more.coupon"),
      disabled: !promoLocked && (!online || !hasItems),
      hint: promoLocked ? undefined : !online ? needsConnection : !hasItems ? addItems : undefined,
      locked: promoLocked,
      gate: {
        plan: FEATURE_MIN_PLAN.loyaltyAndPromotions,
        label: t("cashierCart.more.lockedPromotions"),
      },
    },
    {
      action: "redeemPoints",
      icon: Star,
      label: t("cashierCart.more.redeemPoints"),
      disabled: !promoLocked && (!online || !hasCustomer || !loyaltyEnabled || !hasItems),
      hint: promoLocked
        ? undefined
        : !online
          ? needsConnection
          : !hasCustomer
            ? t("cashierCart.more.hintNeedsCustomer")
            : !loyaltyEnabled
              ? t("cashierCart.more.hintLoyaltyOff")
              : !hasItems
                ? addItems
                : undefined,
      locked: promoLocked,
      gate: {
        plan: FEATURE_MIN_PLAN.loyaltyAndPromotions,
        label: t("cashierCart.more.lockedPromotions"),
      },
    },
    {
      action: "reprintLast",
      icon: Printer,
      label: t("cashierCart.more.reprintLast"),
      disabled: !canReprint,
      hint: canReprint ? undefined : t("cashierCart.actions.noLastReceipt"),
      locked: false,
    },
    {
      action: "clear",
      icon: Trash2,
      label: t("cashierCart.more.clear"),
      disabled: !canClear,
      locked: false,
    },
  ];

  const select = (tile: Tile) => {
    // Close first, whatever happens next: the sheet's own overlay would cover
    // the upgrade banner if a gate fails, and would stack under the next dialog.
    onOpenChange(false);
    if (tile.gate && !requireFeature(tile.gate.plan, tile.gate.label)) return;
    onAction(tile.action);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.more.title")}
        description={t("cashierCart.more.description")}
        maxWidth="md"
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.action}
                type="button"
                disabled={tile.disabled}
                data-action={tile.action}
                data-locked={tile.locked || undefined}
                onClick={() => select(tile)}
                className={cn(
                  "relative flex min-h-[72px] touch-manipulation flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-colors",
                  "enabled:hover:bg-accent enabled:active:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm leading-tight font-medium">{tile.label}</span>
                {tile.hint && (
                  <span className="text-muted-foreground text-[11px] leading-tight">
                    {tile.hint}
                  </span>
                )}
                {tile.locked && (
                  <span
                    className="absolute top-1.5 right-1.5 text-amber-600 dark:text-amber-400"
                    title={t("cashierCart.more.locked")}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("cashierCart.more.locked")}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
