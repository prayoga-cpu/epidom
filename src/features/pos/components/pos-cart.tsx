"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Trash2, Pause, Info } from "lucide-react";
import { usePosCart } from "../hooks/use-pos-cart";
import { PosCartItem } from "./pos-cart-item";
import { useCurrency } from "@/components/providers/currency-provider";
import { useState } from "react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";
import { PosHoldDialog, type HoldFormValues } from "./pos-hold-dialog";
import { usePosSession } from "../hooks/use-pos-session";
import { useHoldOrder } from "../hooks/use-hold-order";
import { toast } from "sonner";

interface PosCartProps {
  storeId: string;
  storeName?: string;
  onRequestCheckout?: () => void;
}

export function PosCart({ storeId, storeName, onRequestCheckout }: PosCartProps) {
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
      toast.error(t("pos.orderCard.holdFailed"));
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-full flex-col items-center justify-center border-l p-6 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <ShoppingBag className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="text-foreground mb-1 font-semibold">{t("pos.cart.empty")}</h3>
        <p className="text-sm">{t("pos.cart.emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col border-l">
      {/* Cart Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="font-semibold">
          {t("pos.title")} <span className="text-muted-foreground ml-1">({totalItems})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={cart.clearCart}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("pos.cart.clear")}
        </Button>
      </div>

      {cart.resumingOrderId && (
        <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("pos.orderCard.resumedBanner")}</span>
        </div>
      )}

      {/* Cart Items */}
      <ScrollArea className="flex-1">
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
      </ScrollArea>

      {/* Cart Footer / Totals */}
      <div className="bg-muted/20 border-t p-4">
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
            className="shrink-0"
            onClick={handleHoldClick}
            disabled={holdOrder.isPending}
            title={t("pos.cart.hold")}
          >
            <Pause className="h-4 w-4" />
          </Button>
          <Button
            className="w-full"
            size="lg"
            onClick={() => (onRequestCheckout ? onRequestCheckout() : setIsCheckoutOpen(true))}
          >
            {t("pos.cart.pay")} {formatPrice(cart.total)}
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
