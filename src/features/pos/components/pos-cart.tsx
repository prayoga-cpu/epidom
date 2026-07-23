"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Trash2, Pause, Info, X } from "lucide-react";
import { usePosCart } from "../hooks/use-pos-cart";
import { PosCartItem } from "./pos-cart-item";
import { useCurrency } from "@/components/providers/currency-provider";
import { useState } from "react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";
import { PosHoldDialog, type HoldFormValues } from "./pos-hold-dialog";
import { usePosSession } from "../hooks/use-pos-session";
import { useHoldOrder } from "../hooks/use-hold-order";
import { ApiClientError } from "@/lib/api/client";
import { toast } from "sonner";

interface PosCartProps {
  storeId: string;
  storeName?: string;
  onRequestCheckout?: () => void;
  /** Renders an explicit close (X) button in the header — only passed by
   * the mobile Dialog wrapper, which has its own close button disabled in
   * favor of this one sitting in the header's normal flex flow. The desktop
   * sidebar usage doesn't pass this, so no close button renders there. */
  onClose?: () => void;
}

export function PosCart({ storeId, storeName, onRequestCheckout, onClose }: PosCartProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const cart = usePosCart();
  const { staffName, shiftId } = usePosSession();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHoldOpen, setIsHoldOpen] = useState(false);
  const holdOrder = useHoldOrder(storeId);

  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const handleHoldClick = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(t("pos.cart.holdOffline"));
      return;
    }
    setIsHoldOpen(true);
  };

  const handleHoldSubmit = async (data: HoldFormValues) => {
    try {
      await holdOrder.mutateAsync({
        items: cart.items,
        orderType: data.orderType,
        tableNumber: data.tableNumber || undefined,
        customerName: data.customerName || undefined,
        notes: data.notes || undefined,
        shiftId: shiftId ?? undefined,
        orderId: cart.resumingOrderId ?? undefined,
      });
      cart.clearCart();
      setIsHoldOpen(false);
      toast.success(t("pos.orderCard.holdSuccess"));
    } catch (error) {
      // Surface the server's real reason (e.g. a stale item that's no longer
      // on the menu) instead of a blanket failure message, same as checkout.
      const serverMessage = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(serverMessage || t("pos.orderCard.holdFailed"));
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center border-l p-6 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <ShoppingBag className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="text-foreground mb-1 font-semibold">{t("pos.cart.empty")}</h3>
        <p className="text-sm">{t("pos.cart.emptyDesc")}</p>
      </div>
    );
  }

  return (
    // flex-1 min-h-0 (not h-full): both consumers (the desktop sidebar pane
    // in pos-shell.tsx, the Dialog in pos-mobile-cart.tsx) are themselves
    // flex columns, but the mobile Dialog only has `height: auto` clamped
    // by `max-height` — not a truly definite height — so a percentage-based
    // `h-full` here doesn't reliably resolve through the flex chain. Sizing
    // via flex-1 (grow to fill the flex parent) instead of a percentage
    // avoids that fragile dependency entirely.
    <div className="bg-background flex min-h-0 flex-1 flex-col border-l">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="font-semibold">
          {t("pos.title")} <span className="text-muted-foreground ml-1">({totalItems})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-10 touch-manipulation"
            onClick={cart.clearCart}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("pos.cart.clear")}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-10 w-10 shrink-0 touch-manipulation"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          )}
        </div>
      </div>

      {cart.resumingOrderId && (
        <div className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("pos.orderCard.resumedBanner")}</span>
        </div>
      )}

      {/* Cart Items — plain overflow-y-auto (not the Radix ScrollArea
          component): this exact div + flex-1 + min-h-0 + overflow-y-auto
          shape is already proven working for a mobile cart drawer in
          public-menu.tsx. ScrollArea wraps content in an extra
          Root/Viewport pair that (in this auto-height + max-height
          ancestor chain specifically) was never actually detecting an
          overflow to scroll, so content just got clipped by the dialog
          around it instead of scrolling. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col pb-4">
          {cart.items.map((item: any) => (
            <PosCartItem
              key={item.id}
              item={item}
              onUpdateQuantity={cart.updateQuantity}
              onRemove={cart.removeItem}
            />
          ))}
        </div>
      </div>

      {/* Cart Footer / Totals — shrink-0 so it can never be compressed by
          the flex column, bg-background (not bg-muted/20) so it's fully
          opaque against the scrollable list behind it, and a shadow above
          the border makes the "this is a separate, fixed panel" boundary
          unambiguous rather than just a thin line flush against the last
          scrolled item. */}
      <div className="bg-background shrink-0 border-t p-3 shadow-[0_-6px_10px_-6px_rgba(0,0,0,0.15)] sm:p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.cart.subtotal")}</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.cart.tax")}</span>
            <span>{formatPrice(cart.tax)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
            <span>{t("pos.cart.total")}</span>
            <span className="text-primary">{formatPrice(cart.total)}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-12 shrink-0 touch-manipulation"
            onClick={handleHoldClick}
            disabled={holdOrder.isPending}
            title={t("pos.cart.hold")}
          >
            <Pause className="h-4 w-4" />
          </Button>
          <Button
            // flex-1 (not w-full!): width:100% ignores sibling elements in a
            // flex row, so it claimed the *entire* row's width on top of the
            // Hold button + gap, overflowing past the panel's right edge by
            // exactly that much. flex-1 correctly grows to fill only the
            // space actually left over. h-auto + min-h-12 (not a fixed h-12)
            // lets a large total's text wrap onto a second line instead of
            // being cropped; min-w-0 lets it shrink below its content's
            // natural (nowrap) width so wrapping can happen at all.
            className="h-auto min-h-12 min-w-0 flex-1 touch-manipulation py-3"
            size="lg"
            onClick={() => (onRequestCheckout ? onRequestCheckout() : setIsCheckoutOpen(true))}
          >
            <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-base whitespace-normal">
              <span>{t("pos.cart.pay")}</span>
              <span>{formatPrice(cart.total)}</span>
            </span>
          </Button>
        </div>
      </div>

      {!onRequestCheckout && (
        <PosCheckoutDialog
          open={isCheckoutOpen}
          onOpenChange={setIsCheckoutOpen}
          storeId={storeId}
          storeName={storeName}
          cashierName={staffName ?? undefined}
          shiftId={shiftId ?? undefined}
        />
      )}

      <PosHoldDialog
        open={isHoldOpen}
        onOpenChange={setIsHoldOpen}
        onSubmit={handleHoldSubmit}
        isSubmitting={holdOrder.isPending}
      />
    </div>
  );
}
