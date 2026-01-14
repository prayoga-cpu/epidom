/**
 * Cart Component
 *
 * Premium cart sidebar with checkout
 */

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  CheckCircle,
  CreditCard,
  Receipt,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "../cart-store";
import { processCheckout } from "../actions";

export function Cart() {
  const params = useParams();
  const router = useRouter();
  const storeId = params?.storeId as string;

  const { cart, updateQuantity, removeItem, clearCart, itemCount } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;

    setIsProcessing(true);
    setLastOrder(null);

    try {
      const result = await processCheckout({
        storeId,
        items: cart.items,
        total: cart.total,
      });

      if (result.success && result.orderNumber) {
        setLastOrder(result.orderNumber);
        clearCart();
        // Auto-clear success message after 5 seconds
        setTimeout(() => setLastOrder(null), 5000);
      } else {
        alert(result.error || "Checkout failed");
      }
    } catch (error) {
      alert("Checkout failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Cart</h2>
            <p className="text-xs text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
        {cart.items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-muted-foreground hover:text-destructive"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Success Message */}
      {lastOrder && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 p-4 animate-in slide-in-from-top-2">
          <div className="rounded-full bg-green-500 p-2">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-700 dark:text-green-400">Sale Complete!</p>
            <p className="text-xs text-green-600 dark:text-green-500 font-mono">{lastOrder}</p>
          </div>
          <Sparkles className="h-5 w-5 text-green-500 animate-pulse" />
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto py-4 -mx-2 px-2">
        {cart.items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="rounded-2xl bg-muted/30 p-6 mb-4">
              <Receipt className="h-10 w-10 opacity-30" />
            </div>
            <p className="font-medium">Cart is empty</p>
            <p className="text-sm mt-1">Add products to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={item.productId}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                  <p className="text-sm font-bold mt-1 tabular-nums">
                    Rp {(item.unitPrice * item.quantity).toLocaleString()}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1 rounded-full border bg-muted/30 p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-background"
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity - 1)
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-background"
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity + 1)
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Checkout */}
      <div className="border-t pt-4 space-y-4">
        {/* Totals */}
        {cart.items.length > 0 && (
          <div className="space-y-2 rounded-xl bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">Rp {cart.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">Rp 0</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between font-bold text-xl">
              <span>Total</span>
              <span className="tabular-nums text-primary">
                Rp {cart.total.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Checkout Button */}
        <Button
          className="w-full h-14 text-lg font-bold gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
          disabled={cart.items.length === 0 || isProcessing}
          onClick={handleCheckout}
        >
          {isProcessing ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              Complete Sale
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
