"use client";

import { Loader2, MoreHorizontal, Printer, Tag } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PosCartActionsProps {
  onDiscount: () => void;
  onReprintLast: () => void;
  onMore: () => void;
  /** Disables Discount — there is nothing to discount on an empty bill. */
  discountDisabled?: boolean;
  /** A discount (manual, preset or coupon) is on the bill — the button says so. */
  discountActive?: boolean;
  /** False until a sale has been completed on this device: nothing to reprint yet. */
  canReprint: boolean;
  isPrinting?: boolean;
}

/**
 * The always-visible quick row: `[Discount] [Reprint Last] [More ⋯]`.
 *
 * Reprint sits on the surface (not buried in More) because "the customer wants
 * another copy" is the most common thing a cashier does right after a sale.
 * Everything rarer lives in the More sheet.
 *
 * Three `flex-1` buttons (never `w-full`) share the row; `min-w-0` lets a long
 * translation shrink (wrapping its label) instead of overflowing the ~320px panel.
 */
export function PosCartActions({
  onDiscount,
  onReprintLast,
  onMore,
  discountDisabled,
  discountActive,
  canReprint,
  isPrinting,
}: PosCartActionsProps) {
  const { t } = useI18n();
  // h-auto + min-h-11 (not a fixed h-11) and whitespace-normal: at the ~320px
  // panel width each button is ~93px, and "Reprint Last" (or a longer French /
  // Indonesian label) wraps onto a second line instead of being cut off — a
  // truncated action name is worse than a taller button.
  const buttonClass =
    "h-auto min-h-11 min-w-0 flex-1 gap-1 px-1.5 py-1 text-xs leading-tight whitespace-normal touch-manipulation";

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className={cn(buttonClass, discountActive && "border-primary text-primary")}
        onClick={onDiscount}
        disabled={discountDisabled}
      >
        <Tag className="h-4 w-4" />
        <span>{t("cashierCart.actions.discount")}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className={buttonClass}
        onClick={onReprintLast}
        disabled={!canReprint || isPrinting}
        title={canReprint ? undefined : t("cashierCart.actions.noLastReceipt")}
      >
        {isPrinting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span>{t("cashierCart.actions.reprintLast")}</span>
      </Button>
      <Button type="button" variant="outline" className={buttonClass} onClick={onMore}>
        <MoreHorizontal className="h-4 w-4" />
        <span>{t("cashierCart.actions.more")}</span>
      </Button>
    </div>
  );
}
