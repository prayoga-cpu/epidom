"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Trash2 } from "lucide-react";
import { usePosCart } from "../hooks/use-pos-cart";
import { PosCartItem } from "./pos-cart-item";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { useState } from "react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";

interface PosCartProps {
  storeId: string;
  storeName?: string;
}

export function PosCart({ storeId, storeName }: PosCartProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const cart = usePosCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  if (cart.items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center border-l bg-muted/20 p-6 text-center text-muted-foreground">
        <div className="mb-4 rounded-full bg-muted p-4">
          <ShoppingBag className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="mb-1 font-semibold text-foreground">
          {t("pos.cart.empty")}
        </h3>
        <p className="text-sm">{t("pos.cart.emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Cart Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="font-semibold">
          {t("pos.title")} <span className="ml-1 text-muted-foreground">({totalItems})</span>
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
      <div className="border-t bg-muted/20 p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.cart.subtotal")}</span>
            <span>{formatCurrency(cart.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("pos.cart.tax")}</span>
            <span>{formatCurrency(cart.tax, currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
            <span>{t("pos.cart.total")}</span>
            <span className="text-primary">{formatCurrency(cart.total, currency)}</span>
          </div>
        </div>
        
        <Button 
          className="mt-4 w-full" 
          size="lg"
          onClick={() => setIsCheckoutOpen(true)}
        >
          {t("pos.cart.pay")} {formatCurrency(cart.total, currency)}
        </Button>
      </div>

      <PosCheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        storeId={storeId}
        storeName={storeName}
      />
    </div>
  );
}
