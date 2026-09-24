"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/use-confirm";
import { Info, Loader2, Menu, ReceiptText, Save, ShoppingBag } from "lucide-react";
import { usePosCart } from "../hooks/use-pos-cart";
import { PosCartItem } from "./pos-cart-item";
import { PosCartHeader } from "./pos-cart-header";
import { PosCartCustomer } from "./pos-cart-customer";
import { PosCartTotals } from "./pos-cart-totals";
import { PosMoreSheet, type MoreAction } from "./pos-more-sheet";
import { PosCustomItemDialog } from "./pos-custom-item-dialog";
import { PosDiscountDialog } from "./pos-discount-dialog";
import { PosCouponDialog } from "./pos-coupon-dialog";
import { PosRedeemPointsDialog } from "./pos-redeem-points-dialog";
import { PosMergeBillDialog } from "./pos-merge-bill-dialog";
import { PosSplitBillDialog } from "./pos-split-bill-dialog";
import { useCurrency } from "@/components/providers/currency-provider";
import { useEffect, useState } from "react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";
import { PosHoldDialog, type HoldFormValues } from "./pos-hold-dialog";
import { usePosSession } from "../hooks/use-pos-session";
import { cartToHoldInput, useHoldOrder } from "../hooks/use-hold-order";
import { useKdsSettings } from "../hooks/use-kds-settings";
import { useLastReceipt } from "../hooks/use-last-receipt";
import { usePrintReceipt } from "../hooks/use-print-receipt";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { useLoyaltySettings } from "../hooks/use-loyalty-settings";
import { usePosOrdersSnapshot } from "../hooks/use-pos-orders-snapshot";
import { buildBillReceipt } from "../lib/build-bill-receipt";
import { ApiClientError } from "@/lib/api/client";
import { toast } from "sonner";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import { useReceiptSettings } from "@/features/dashboard/profile/hooks/use-receipt-settings";
import { usePosMenu } from "../hooks/use-pos-menu";
import { usePosModeUpgradeGate } from "@/features/pos-mode/pos-mode-upgrade-banner";
import { useOnlineStatus } from "@/hooks/use-network-status";
import { FEATURE_MIN_PLAN, planAtLeast } from "@/lib/plans/entitlements";
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

/**
 * The cashier's live bill (right pane of /pos, and the mobile cart dialog).
 *
 * Top to bottom: header (Order Queue, Dine In | Take Away, pax/table), then a
 * scrolling receipt — the optional customer row followed by the lines — and a
 * pinned footer with the totals, Save Bill / Print Bill and the big Charge
 * button, with a square burger (☰) More button beside it. Everything the cashier needs
 * is in this panel; the only pop-ups are the deliberate ones (More — which holds
 * Discount, Reprint Last and the rarer actions — and the discount / coupon /
 * points / custom item / merge / split / save dialogs).
 */
export function PosCart({ storeId, storeName, onRequestCheckout, onClose }: PosCartProps) {
  const { t, locale } = useI18n();
  // Cart/menu-item amounts are literal in the store's display currency,
  // never IDR — passing `currency` skips formatPrice's default base-currency
  // conversion. See pos-order-builder.ts.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const cart = usePosCart();
  const { staffName, shiftId } = usePosSession();
  const online = useOnlineStatus();
  const { confirm, confirmDialog } = useConfirm();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHoldOpen, setIsHoldOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [isPointsOpen, setIsPointsOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const holdOrder = useHoldOrder(storeId);
  // Saving a bill only makes sense with an Active Queue to park it in — when the
  // store has turned it off, every order settles straight to
  // DELIVERED/history instead (see resolveSettledOrderStatus), so Save Bill is
  // disabled rather than left to fail server-side after the cashier fills
  // out the dialog.
  const { data: kdsSettings } = useKdsSettings(storeId);
  const activeQueueEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;
  const { data: financeSettings } = useFinanceSettings(storeId);
  const { data: receiptSettings } = useReceiptSettings(storeId);
  // Shares the same query cache as pos-shell.tsx's usePosMenu call — used
  // here only to look up a cart line's option groups when the cashier taps
  // the edit affordance to reconfigure it in place.
  const { data: menuData } = usePosMenu(storeId);
  // Only to print a resumed bill under its real number.
  const { data: queueOrders } = usePosOrdersSnapshot(storeId);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const { currentPlan } = usePosModeUpgradeGate();

  const lastReceipt = useLastReceipt((s) => s.receipt);
  const { print, isPrinting } = usePrintReceipt();
  const paperWidth = usePrinterSettings((s) => s.printers.MAIN.paperWidth);

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

  // Same idea for loyalty rules: the cart's points math (and the customer
  // chip's "N pts") read them from the store. Fetched only where the plan
  // allows and the till is online — the route is OPERATIONS-gated server-side,
  // so an ungated call would just be a 403 in the console. Nothing is written
  // until data arrives, so a rehydrated cart keeps its persisted rules through
  // the first moments (and through an offline start) instead of flickering to
  // "no loyalty".
  const loyaltyAllowed = planAtLeast(currentPlan, FEATURE_MIN_PLAN.loyaltyAndPromotions);
  const { data: loyaltySettings } = useLoyaltySettings(storeId, loyaltyAllowed && online);
  useEffect(() => {
    if (loyaltySettings) cart.setLoyaltyRules(loyaltySettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loyaltySettings]);

  const hasItems = cart.items.length > 0;
  const hasSaleState =
    hasItems ||
    cart.customer !== null ||
    cart.discountSource !== null ||
    cart.redeemPoints > 0 ||
    cart.resumingOrderId !== null;

  const openDiscount = () => setIsDiscountOpen(true);

  const handleClear = async () => {
    // "Clear sale" wipes lines, customer, discount and points at once, and the
    // sale can be large — ask first, but only when there are lines to lose.
    if (hasItems) {
      const ok = await confirm({
        title: t("cashierCart.header.clearConfirmTitle"),
        description: t("cashierCart.header.clearConfirmDesc"),
        confirmText: t("cashierCart.header.clearSale"),
        variant: "destructive",
      });
      if (!ok) return;
    }
    cart.clearCart();
  };

  const handleReprintLast = async () => {
    if (lastReceipt) await print(lastReceipt);
  };

  const handleMoreAction = (action: MoreAction) => {
    switch (action) {
      case "customItem":
        return setIsCustomItemOpen(true);
      case "splitBill":
        return setIsSplitOpen(true);
      case "mergeBill":
        return setIsMergeOpen(true);
      case "discount":
        // Already gated by the sheet.
        return openDiscount();
      case "coupon":
        return setIsCouponOpen(true);
      case "redeemPoints":
        return setIsPointsOpen(true);
      case "reprintLast":
        return void handleReprintLast();
      case "clear":
        return void handleClear();
    }
  };

  const handlePrintBill = async () => {
    // Provisional, unpaid: a resumed bill prints under its real number, a fresh
    // one has none yet (buildBillReceipt prints a placeholder).
    const resumedNumber = cart.resumingOrderId
      ? (queueOrders?.find((o) => o.id === cart.resumingOrderId)?.orderNumber ?? null)
      : null;
    await print(
      buildBillReceipt({
        cart,
        storeName,
        currency,
        locale,
        receiptSettings,
        taxLabel: financeSettings?.taxLabel,
        cashierName: staffName ?? undefined,
        paperWidth,
        orderNumber: resumedNumber,
      })
    );
  };

  const handleSaveBillClick = () => {
    if (!activeQueueEnabled) {
      toast.error(t("cashierCart.saveBill.unavailable"));
      return;
    }
    if (!online) {
      toast.error(t("cashierCart.saveBill.offline"));
      return;
    }
    setIsHoldOpen(true);
  };

  const handleHoldSubmit = async (data: HoldFormValues) => {
    try {
      await holdOrder.mutateAsync(
        cartToHoldInput(cart, {
          shiftId: shiftId ?? undefined,
          notes: data.notes,
          label: data.customerName,
          tableNumber: data.tableNumber,
        })
      );
      cart.clearCart();
      setIsHoldOpen(false);
      toast.success(t("cashierCart.saveBill.saved"));
    } catch (error) {
      // Surface the server's real reason (e.g. a stale item that's no longer
      // on the menu) instead of a blanket failure message, same as checkout.
      const serverMessage = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(serverMessage || t("cashierCart.saveBill.failed"));
    }
  };

  return (
    // flex-1 min-h-0 (not h-full): both consumers (the desktop sidebar pane
    // in pos-shell.tsx, the Dialog in pos-mobile-cart.tsx) are themselves
    // flex columns, but the mobile Dialog only has `height: auto` clamped
    // by `max-height` — not a truly definite height — so a percentage-based
    // `h-full` here doesn't reliably resolve through the flex chain. Sizing
    // via flex-1 (grow to fill the flex parent) instead of a percentage
    // avoids that fragile dependency entirely.
    <div className="bg-background flex min-h-0 flex-1 flex-col border-l">
      <PosCartHeader storeId={storeId} onClear={handleClear} onClose={onClose} />

      {cart.resumingOrderId && (
        <div className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("pos.orderCard.resumedBanner")}</span>
        </div>
      )}

      {/* The receipt: customer row, then the lines — plain overflow-y-auto (not
          the Radix ScrollArea component): this exact div + flex-1 + min-h-0 +
          overflow-y-auto shape is already proven working for a mobile cart
          drawer in public-menu.tsx. ScrollArea wraps content in an extra
          Root/Viewport pair that (in this auto-height + max-height ancestor
          chain specifically) was never actually detecting an overflow to
          scroll, so content just got clipped by the dialog around it instead
          of scrolling.

          The customer row lives INSIDE this scroller rather than above it as a
          shrink-0 block: expanded (search results, the new-customer form) it
          can be tall, and as a fixed block it would squeeze the lines and
          footer off a short tablet screen. Here it just scrolls. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PosCartCustomer storeId={storeId} />
        {hasItems ? (
          <div className="flex flex-col pt-2 pb-2">
            {cart.items.map((item: CartItem) => (
              <PosCartItem
                key={item.id}
                item={item}
                onUpdateQuantity={cart.updateQuantity}
                onRemove={cart.removeItem}
                onEdit={setEditingItem}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="bg-muted mb-4 rounded-full p-4">
              <ShoppingBag className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-foreground mb-1 font-semibold">{t("pos.cart.empty")}</h3>
            <p className="text-sm">{t("pos.cart.emptyDesc")}</p>
          </div>
        )}
      </div>

      {/* Footer — shrink-0 so it can never be compressed by the flex column,
          bg-background (not bg-muted/20) so it's fully opaque against the
          scrollable list behind it, and a shadow above the border makes the
          "this is a separate, fixed panel" boundary unambiguous rather than
          just a thin line flush against the last scrolled item. */}
      <div className="bg-background shrink-0 space-y-2 border-t p-3 shadow-[0_-6px_10px_-6px_rgba(0,0,0,0.15)] sm:p-4">
        {hasItems && <PosCartTotals taxLabel={financeSettings?.taxLabel} />}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-0 flex-1 touch-manipulation gap-1.5 px-2"
            onClick={handleSaveBillClick}
            disabled={!hasItems || holdOrder.isPending}
            title={activeQueueEnabled ? undefined : t("cashierCart.saveBill.unavailable")}
          >
            {holdOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="truncate">{t("cashierCart.footer.saveBill")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-0 flex-1 touch-manipulation gap-1.5 px-2"
            onClick={handlePrintBill}
            disabled={!hasItems || isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ReceiptText className="h-4 w-4" />
            )}
            <span className="truncate">{t("cashierCart.footer.printBill")}</span>
          </Button>
        </div>

        {/* items-center: if a large total wraps Charge onto a second line, the
            square More button stays a square and sits at the row's middle. */}
        <div className="flex items-center gap-2">
          <Button
            // flex-1 (not w-full!): width:100% ignores sibling elements in a
            // flex row, so it would claim the *entire* row's width on top of
            // any sibling + gap, overflowing past the panel's right edge by
            // exactly that much. flex-1 correctly grows to fill only the
            // space actually left over. h-auto + min-h-12 (not a fixed h-12)
            // lets a large total's text wrap onto a second line instead of
            // being cropped; min-w-0 lets it shrink below its content's
            // natural (nowrap) width so wrapping can happen at all.
            className="h-auto min-h-12 min-w-0 flex-1 touch-manipulation py-3"
            size="lg"
            disabled={!hasItems}
            onClick={() => (onRequestCheckout ? onRequestCheckout() : setIsCheckoutOpen(true))}
          >
            <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-base whitespace-normal">
              <span>{t("cashierCart.footer.charge")}</span>
              <span className="tabular-nums">{formatPrice(cart.total)}</span>
            </span>
          </Button>
          {/* Icon-only, square: 48px matches Charge's min-h-12 so the two line up.
              Discount, Reprint Last, coupons, split/merge and the rest live in the
              sheet it opens; the accessible name stands in for the visible label.
              A burger, not the ⋯ dots: the POS tab bar's own "More" already owns
              the dots, and two identical-looking buttons would read as the same one. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 touch-manipulation"
            aria-label={t("cashierCart.actions.more")}
            title={t("cashierCart.actions.more")}
            onClick={() => setIsMoreOpen(true)}
          >
            <Menu className="size-5" />
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

      <PosMoreSheet
        open={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        onAction={handleMoreAction}
        online={online}
        hasItems={hasItems}
        hasCustomer={cart.customer !== null}
        loyaltyEnabled={cart.loyaltyRules?.enabled === true}
        activeQueueEnabled={activeQueueEnabled}
        canReprint={lastReceipt !== null}
        canClear={hasSaleState}
      />

      <PosCustomItemDialog open={isCustomItemOpen} onOpenChange={setIsCustomItemOpen} />
      <PosDiscountDialog open={isDiscountOpen} onOpenChange={setIsDiscountOpen} storeId={storeId} />
      <PosCouponDialog open={isCouponOpen} onOpenChange={setIsCouponOpen} storeId={storeId} />
      <PosRedeemPointsDialog open={isPointsOpen} onOpenChange={setIsPointsOpen} />
      <PosMergeBillDialog
        open={isMergeOpen}
        onOpenChange={setIsMergeOpen}
        storeId={storeId}
        shiftId={shiftId ?? undefined}
      />
      <PosSplitBillDialog
        open={isSplitOpen}
        onOpenChange={setIsSplitOpen}
        storeId={storeId}
        storeName={storeName}
        cashierName={staffName ?? undefined}
        shiftId={shiftId ?? undefined}
      />

      <PosHoldDialog
        open={isHoldOpen}
        onOpenChange={setIsHoldOpen}
        onSubmit={handleHoldSubmit}
        isSubmitting={holdOrder.isPending}
        defaults={{
          orderType: cart.orderType,
          onlinePlatform: cart.onlinePlatform,
          guestCount: cart.guestCount,
          tableNumber: cart.tableNumber,
          customerName: cart.customer?.name ?? null,
        }}
        dropsPromotions={cart.discountSource?.kind === "coupon" || cart.redeemPoints > 0}
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

      {confirmDialog}
    </div>
  );
}
