"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingBag, Trash2, Pause, Info, X, Tag } from "lucide-react";
import { usePosCart } from "../hooks/use-pos-cart";
import { PosCartItem } from "./pos-cart-item";
import { useCurrency } from "@/components/providers/currency-provider";
import { useEffect, useState } from "react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";
import { PosHoldDialog, type HoldFormValues } from "./pos-hold-dialog";
import { usePosSession } from "../hooks/use-pos-session";
import { useHoldOrder } from "../hooks/use-hold-order";
import { ApiClientError } from "@/lib/api/client";
import { toast } from "sonner";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import { usePosMenu } from "../hooks/use-pos-menu";
import { MenuItemOptionsDialog } from "@/components/shared/menu-item-options-dialog";
import { getMergedOptionGroups } from "@/lib/utils/menu-item-options";
import type { CartItem } from "../types/pos.types";

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
  // Cart/menu-item amounts are literal in the store's display currency,
  // never IDR — passing `currency` skips formatPrice's default base-currency
  // conversion. See pos-order-builder.ts.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const cart = usePosCart();
  const { staffName, shiftId } = usePosSession();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHoldOpen, setIsHoldOpen] = useState(false);
  const holdOrder = useHoldOrder(storeId);
  const { data: financeSettings } = useFinanceSettings(storeId);
  // Shares the same query cache as pos-shell.tsx's usePosMenu call — used
  // here only to look up a cart line's option groups when the cashier taps
  // the edit affordance to reconfigure it in place.
  const { data: menuData } = usePosMenu(storeId);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const editingMenuItem = editingItem
    ? menuData?.categories
        .flatMap((c: any) => c.items)
        .find((i: any) => i.id === editingItem.menuItemId)
    : null;

  // Keep the cart preview in sync with the store's real tax/service-charge
  // settings, so what the cashier sees matches what the server will freeze
  // onto the order.
  useEffect(() => {
    if (financeSettings) {
      cart.setFinanceSettings({
        taxEnabled: financeSettings.taxEnabled,
        taxRate: financeSettings.taxRate,
        taxInclusive: financeSettings.taxInclusive,
        serviceChargeEnabled: financeSettings.serviceChargeEnabled,
        serviceChargeRate: financeSettings.serviceChargeRate,
        processingFeeEnabled: false,
        processingFeeOverrides: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeSettings]);

  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const openDiscountPopover = (open: boolean) => {
    if (open) {
      setDiscountInput(cart.discountAmount > 0 ? String(cart.discountAmount) : "");
      setDiscountReasonInput(cart.discountReason ?? "");
    }
    setIsDiscountOpen(open);
  };

  const handleApplyDiscount = () => {
    const amount = Number(discountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      cart.setDiscount(null);
    } else {
      cart.setDiscount(amount, discountReasonInput.trim() || undefined);
    }
    setIsDiscountOpen(false);
  };

  const handleRemoveDiscount = () => {
    cart.setDiscount(null);
    setDiscountInput("");
    setDiscountReasonInput("");
    setIsDiscountOpen(false);
  };

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
              onEdit={setEditingItem}
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
          {cart.serviceCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("pos.cart.serviceCharge")}</span>
              <span>{formatPrice(cart.serviceCharge)}</span>
            </div>
          )}
          {cart.discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("pos.cart.discount")}
                {cart.discountReason ? ` (${cart.discountReason})` : ""}
              </span>
              <span className="text-orange-600">-{formatPrice(cart.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.cart.tax")}</span>
            <span>{formatPrice(cart.tax)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
            <span>{t("pos.cart.total")}</span>
            <span className="text-primary">{formatPrice(cart.total)}</span>
          </div>
        </div>

        <Popover open={isDiscountOpen} onOpenChange={openDiscountPopover}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-2 h-9 gap-1.5 px-2"
              disabled={cart.items.length === 0}
            >
              <Tag className="h-3.5 w-3.5" />
              {cart.discountAmount > 0 ? t("pos.cart.editDiscount") : t("pos.cart.addDiscount")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pos-discount-amount">{t("pos.cart.discountAmount")}</Label>
              <Input
                id="pos-discount-amount"
                type="number"
                inputMode="decimal"
                min={0}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-discount-reason">{t("pos.cart.discountReason")}</Label>
              <Input
                id="pos-discount-reason"
                value={discountReasonInput}
                onChange={(e) => setDiscountReasonInput(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="flex justify-end gap-2">
              {cart.discountAmount > 0 && (
                <Button variant="outline" size="sm" onClick={handleRemoveDiscount}>
                  {t("common.actions.remove")}
                </Button>
              )}
              <Button size="sm" onClick={handleApplyDiscount}>
                {t("common.actions.apply")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mt-2 flex gap-2">
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

      {editingItem && (
        <MenuItemOptionsDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          itemName={editingItem.name}
          groups={getMergedOptionGroups(editingMenuItem, editingMenuItem?.product)}
          initialSelected={editingItem.modifiers}
          initialNotes={editingItem.notes}
          formatPrice={formatPrice}
          onConfirm={({ selectedOptions, notes }) => {
            cart.updateItemOptions(editingItem.id, selectedOptions, notes);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
