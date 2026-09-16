"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosCart } from "../hooks/use-pos-cart";
import { useCurrency } from "@/components/providers/currency-provider";

interface PosHeaderProps {
  /** Opens the mobile cart dialog — the cart button rendered here (mobile
   * only) doesn't own that dialog's state, since it lives in the sibling
   * PosMobileCart, one level up in PosShell. Store name, connection status
   * and the staff badge now live in the persistent PosModeStatusBar
   * (src/features/pos-mode/), one level up again in PosModeShell — this bar
   * is just what's left that's specific to /pos itself on narrow viewports. */
  onCartClick: () => void;
}

export function PosHeader({ onCartClick }: PosHeaderProps) {
  // Cart total is literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const cart = usePosCart();
  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <div className="bg-background flex h-12 shrink-0 items-center justify-end border-b px-3 md:hidden">
      <Button
        onClick={onCartClick}
        size="sm"
        className="h-11 touch-manipulation gap-1.5 rounded-full px-3"
      >
        <ShoppingBag className="h-4 w-4" />
        {totalItems > 0 && <span className="font-semibold">{totalItems}</span>}
        {cart.total > 0 && <span className="font-bold">{formatPrice(cart.total)}</span>}
      </Button>
    </div>
  );
}
