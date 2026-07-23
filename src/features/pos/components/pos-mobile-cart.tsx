"use client";

import { useState } from "react";
import { Store } from "@prisma/client";
import { ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosSession } from "../hooks/use-pos-session";
import { PosCart } from "./pos-cart";
import { PosCheckoutDialog } from "./pos-checkout-dialog";

interface PosMobileCartProps {
  store: Pick<Store, "id" | "name">;
}

export function PosMobileCart({ store }: PosMobileCartProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const cart = usePosCart();
  const { staffName, shiftId } = usePosSession();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <>
      {cart.items.length > 0 && !cartOpen && (
        <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 mx-auto max-w-md md:hidden">
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

      {/* Dialog (not Sheet/bottom-drawer): a bottom Sheet only ever gets
          `height: auto` clamped by `max-height`, never a truly definite
          height, which repeatedly failed to reliably size/scroll a long
          cart list through the nested flex chain. Dialog + this same
          manual flex/overflow shape is the pattern already proven across
          every other dialog fixed this session. */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent
          className="flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl p-0 md:hidden"
          showCloseButton={false}
        >
          {/* Radix requires a DialogTitle (and warns without a Description)
              for screen readers even when the dialog has its own visible
              header — PosCart's header is a plain div, not a DialogTitle,
              so these stay visually hidden rather than duplicated
              on-screen. */}
          <DialogTitle className="sr-only">{t("pos.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("pos.title")}</DialogDescription>
          <PosCart
            storeId={store.id}
            storeName={store.name}
            onRequestCheckout={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
            onClose={() => setCartOpen(false)}
          />
        </DialogContent>
      </Dialog>

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
