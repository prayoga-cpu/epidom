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
  Sparkles,
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
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted rounded-md p-2">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cart</h2>
            <p className="text-muted-foreground text-xs">
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
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-5 w-5" />
          <div className="flex-1">
            <p className="font-medium">Sale Complete!</p>
            <p className="font-mono text-xs opacity-90">{lastOrder}</p>
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div className="-mx-2 flex-1 overflow-y-auto px-2 py-4">
        {cart.items.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center">
            <div className="bg-muted/30 mb-4 rounded-2xl p-6">
              <Receipt className="h-10 w-10 opacity-30" />
            </div>
            <p className="font-medium">Cart is empty</p>
            <p className="mt-1 text-sm">Add products to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={item.productId}
                className="group bg-card flex items-center gap-3 rounded-lg border p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight font-medium">{item.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">{item.sku}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">
                    Rp {(item.unitPrice * item.quantity).toLocaleString()}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-background h-7 w-7 rounded-full"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-background h-7 w-7 rounded-full"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
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
      <div className="space-y-4 border-t pt-4">
        {/* Totals */}
        {cart.items.length > 0 && (
          <div className="bg-muted/10 space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">Rp {cart.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">Rp 0</span>
            </div>
            <div className="bg-border my-2 h-px" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">Rp {cart.total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Checkout Button */}
        <Button
          className="h-12 w-full gap-2 text-lg font-bold"
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
