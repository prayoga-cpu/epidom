"use client";

import { useState } from "react";
import { Store } from "@prisma/client";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosSession } from "../hooks/use-pos-session";
import { PosCart } from "./pos-cart";
import { PosCheckoutDialog } from "./pos-checkout-dialog";

interface PosMobileCartProps {
  store: Pick<Store, "id" | "name">;
}

export function PosMobileCart({ store }: PosMobileCartProps) {
  const { formatPrice } = useCurrency();
  const cart = usePosCart();
  const { staffName, shiftId } = usePosSession();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <>
      {cart.items.length > 0 && !cartOpen && (
        <div className="fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-md md:hidden">
          <div
            onClick={() => setCartOpen(true)}
            className="bg-primary text-primary-foreground flex cursor-pointer items-center justify-between rounded-2xl p-4 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span className="font-semibold">{totalItems}</span>
            </div>
            <span className="font-bold">{formatPrice(cart.total)}</span>
          </div>
        </div>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl p-0 md:hidden">
          <PosCart
            storeId={store.id}
            storeName={store.name}
            onRequestCheckout={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      <PosCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        storeId={store.id}
        storeName={store.name}
        cashierName={staffName ?? undefined}
        shiftId={shiftId ?? undefined}
      />
    </>
  );
}
