"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosCart } from "../hooks/use-pos-cart";
import { useCurrency } from "@/components/providers/currency-provider";
import { useI18n } from "@/components/lang/i18n-provider";

interface PosHeaderProps {
  /** Opens the mobile cart dialog — the cart button rendered here (mobile
   * only) doesn't own that dialog's state, since it lives in the sibling
   * PosMobileCart, one level up in PosShell. Store name, connection status
   * and the staff badge live in the persistent PosModeStatusBar
   * (src/features/pos-mode/), one level up again in PosModeShell. */
  onCartClick: () => void;
}

/**
 * The phone-width cart button: floating at the bottom right of the till, just
 * above POS Mode's bottom tab bar, where the thumb already is. It used to take
 * a 48px row of its own at the top. Positioned against PosShell's root (which
 * is `relative` and ends where the tab bar begins), not the viewport, so no
 * tab-bar height, safe-area inset or app zoom has to be guessed. The menu keeps
 * pb-24 below its last row so nothing ends up stuck underneath it. Hidden at md+,
 * where the cart is a pane of its own.
 */
export function PosHeader({ onCartClick }: PosHeaderProps) {
  const { t } = useI18n();
  // Cart total is literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const cart = usePosCart();
  const totalItems = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <Button
      onClick={onCartClick}
      // min-w-14 keeps an empty cart a 56px circle; items and a total widen it
      // into a pill growing leftward from the corner.
      className="absolute right-4 bottom-4 z-20 h-14 min-w-14 touch-manipulation gap-1.5 rounded-full px-4 shadow-lg md:hidden"
    >
      <ShoppingBag className="size-5" />
      {/* Named for a screen reader; the count and total still read after it. */}
      <span className="sr-only">{t("pos.cart.open")}</span>
      {totalItems > 0 && <span className="font-semibold">{totalItems}</span>}
      {cart.total > 0 && <span className="font-bold">{formatPrice(cart.total)}</span>}
    </Button>
  );
}
