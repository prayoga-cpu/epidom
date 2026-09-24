"use client";

import Link from "next/link";
import { ChevronDown, ClipboardList, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import {
  ONLINE_PLATFORMS_BY_MARKET,
  POS_ONLINE_PLATFORMS,
  type PosOnlinePlatform,
} from "@/config/aggregator.config";
import { cn } from "@/lib/utils";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosOrdersSnapshot } from "../hooks/use-pos-orders-snapshot";
import { onlinePlatformLabel } from "../lib/order-channel";

interface PosCartHeaderProps {
  storeId: string;
  /** "Clear sale" — owned by PosCart, which asks for confirmation before wiping
   * a bill that has lines, and shares the same handler with the More sheet. */
  onClear: () => void;
  /** Renders an explicit close (X) — only passed by the mobile Dialog wrapper,
   * which has its own close button disabled in favor of this one. */
  onClose?: () => void;
}

const ORDER_TYPES = [
  { value: "DINE_IN", labelKey: "cashierCart.header.dineIn" },
  { value: "TAKEAWAY", labelKey: "cashierCart.header.takeAway" },
] as const;

const SEGMENT_CLASS =
  "flex h-10 min-w-0 flex-1 touch-manipulation items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-colors";

/**
 * Top of the cart panel: the Order Queue shortcut with its live count, "Clear
 * sale", and the Dine In | Take Away | Others switch.
 *
 * "Others" is for an order that came in through a delivery platform and is
 * keyed in by hand: it opens the platforms of the store's market (Fees & Taxes
 * → Market) and, once one is picked, reads as that platform ("GoFood"). The
 * sale is then a DELIVERY recorded against the platform (Order.source), which
 * is what the daily report and the finance channel report split on.
 *
 * Order type lives in the cart store (not in a dialog), so Save Bill and
 * checkout inherit it without asking again. Pax and table moved to the
 * customer row's dialog (PosCartCustomer).
 */
export function PosCartHeader({ storeId, onClear, onClose }: PosCartHeaderProps) {
  const { t } = useI18n();
  const { data: orders } = usePosOrdersSnapshot(storeId);
  const { data: financeSettings } = useFinanceSettings(storeId);

  const orderType = usePosCart((s) => s.orderType);
  const onlinePlatform = usePosCart((s) => s.onlinePlatform);
  const setOrderType = usePosCart((s) => s.setOrderType);
  const setOnlinePlatform = usePosCart((s) => s.setOnlinePlatform);
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

  // INDONESIA mirrors the server's default when a store has no settings row.
  // A platform already on the bill (a resumed bill saved before the market
  // changed) stays listed, so the menu never hides the current choice.
  const marketPlatforms = ONLINE_PLATFORMS_BY_MARKET[financeSettings?.market ?? "INDONESIA"];
  const platforms: PosOnlinePlatform[] =
    onlinePlatform && !marketPlatforms.includes(onlinePlatform)
      ? [onlinePlatform, ...marketPlatforms]
      : marketPlatforms;
  const isOnline = orderType === "DELIVERY" && onlinePlatform !== null;

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

      <div
        role="radiogroup"
        aria-label={t("pos.checkout.orderType")}
        className="bg-muted flex rounded-lg p-1"
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
                SEGMENT_CLASS,
                selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}

        {/* Closes on pick, like a native select: the segment itself then shows
            the choice, so there is nothing left to look at in the menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={isOnline}
              aria-label={
                isOnline
                  ? `${t("cashierCart.header.others")}: ${onlinePlatformLabel(t, onlinePlatform)}`
                  : t("cashierCart.header.others")
              }
              className={cn(
                SEGMENT_CLASS,
                isOnline ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {isOnline ? onlinePlatformLabel(t, onlinePlatform) : t("cashierCart.header.others")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              {t("cashierCart.header.onlineOrderFrom")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={isOnline ? onlinePlatform : ""}
              onValueChange={(value) => {
                if ((POS_ONLINE_PLATFORMS as readonly string[]).includes(value)) {
                  setOnlinePlatform(value as PosOnlinePlatform);
                }
              }}
            >
              {platforms.map((platform) => (
                <DropdownMenuRadioItem
                  key={platform}
                  value={platform}
                  className="min-h-11 touch-manipulation text-sm"
                >
                  {onlinePlatformLabel(t, platform)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
