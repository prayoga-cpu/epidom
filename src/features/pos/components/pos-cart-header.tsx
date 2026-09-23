"use client";

import Link from "next/link";
import { ClipboardList, Users, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePosCart, type CartOrderType } from "../hooks/use-pos-cart";
import { usePosOrdersSnapshot } from "../hooks/use-pos-orders-snapshot";
import { formatPax } from "../lib/cart-format";
import { GuestCountStepper } from "./guest-count-stepper";

interface PosCartHeaderProps {
  storeId: string;
  /** "Clear sale" — owned by PosCart, which asks for confirmation before wiping
   * a bill that has lines, and shares the same handler with the More sheet. */
  onClear: () => void;
  /** Renders an explicit close (X) — only passed by the mobile Dialog wrapper,
   * which has its own close button disabled in favor of this one. */
  onClose?: () => void;
}

const ORDER_TYPES: Array<{ value: CartOrderType; labelKey: string }> = [
  { value: "DINE_IN", labelKey: "cashierCart.header.dineIn" },
  { value: "TAKEAWAY", labelKey: "cashierCart.header.takeAway" },
];

/**
 * Top of the cart panel: the Order Queue shortcut with its live count, "Clear
 * sale", the Dine In | Take Away switch and — for dine-in — the pax/table chip.
 *
 * Order type, guests and table live in the cart store (not in a dialog), so
 * Save Bill and checkout inherit whatever the cashier set here without asking
 * again.
 */
export function PosCartHeader({ storeId, onClear, onClose }: PosCartHeaderProps) {
  const { t } = useI18n();
  const { data: orders } = usePosOrdersSnapshot(storeId);

  const orderType = usePosCart((s) => s.orderType);
  const guestCount = usePosCart((s) => s.guestCount);
  const tableNumber = usePosCart((s) => s.tableNumber);
  const setOrderType = usePosCart((s) => s.setOrderType);
  const setGuestCount = usePosCart((s) => s.setGuestCount);
  const setTableNumber = usePosCart((s) => s.setTableNumber);
  const hasSaleState = usePosCart(
    (s) =>
      s.items.length > 0 ||
      s.customer !== null ||
      s.discountSource !== null ||
      s.redeemPoints > 0 ||
      s.resumingOrderId !== null
  );

  // The Active Queue feed: saved bills, unpaid orders and anything in flight —
  // the same list the queue page shows, so the badge and the page agree.
  const queueCount = orders?.length ?? 0;

  const paxChip = [
    formatPax(t, guestCount),
    tableNumber.trim()
      ? t("cashierCart.header.tableShort").replace("{table}", tableNumber.trim())
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="shrink-0 space-y-2 border-b p-3">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" className="h-11 min-w-0 touch-manipulation gap-2 px-3">
          <Link href={`/store/${storeId}/pos/orders`} onClick={onClose}>
            <ClipboardList className="h-4 w-4" />
            <span className="truncate">{t("cashierCart.header.orderQueue")}</span>
            {queueCount > 0 && (
              <span
                data-testid="order-queue-count"
                className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
              >
                {queueCount}
              </span>
            )}
          </Link>
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-10 touch-manipulation px-2"
            disabled={!hasSaleState}
            onClick={onClear}
          >
            {t("cashierCart.header.clearSale")}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-10 w-10 shrink-0 touch-manipulation"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t("common.actions.close")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* flex-wrap: at the 320px panel width the switch and the pax chip don't
          both fit on one line, so the chip drops underneath; on a wider panel
          they share the row. min-w keeps the switch from collapsing first. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label={t("pos.checkout.orderType")}
          className="bg-muted flex min-w-[10.5rem] flex-1 rounded-lg p-1"
        >
          {ORDER_TYPES.map(({ value, labelKey }) => {
            const selected = orderType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setOrderType(value)}
                className={cn(
                  "h-10 min-w-0 flex-1 touch-manipulation rounded-md px-2 text-sm font-medium transition-colors",
                  selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <span className="truncate">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>

        {orderType === "DINE_IN" && (
          // Not auto-closed on change: the cashier bumps the stepper several
          // times and types a table, so it stays until they tap away.
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 min-w-0 touch-manipulation gap-1.5 px-3"
                aria-label={t("cashierCart.header.paxTableLabel")}
              >
                <Users className="h-4 w-4" />
                <span className="truncate">{paxChip}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="space-y-1.5">
                <Label>{t("pos.checkout.guestCount")}</Label>
                <GuestCountStepper idPrefix="cart" value={guestCount} onChange={setGuestCount} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cart-table-number">{t("pos.checkout.tableOptional")}</Label>
                <Input
                  id="cart-table-number"
                  className="h-11"
                  placeholder="A1, B2..."
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  maxLength={40}
                />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
