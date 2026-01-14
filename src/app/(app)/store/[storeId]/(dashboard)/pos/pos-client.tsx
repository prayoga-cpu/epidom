/**
 * POS Client Component
 *
 * Premium POS interface with cart provider
 */

"use client";

import { CartProvider, useCart } from "@/features/mvp/pos/cart-store";
import { ProductGrid, Cart } from "@/features/mvp/pos/components";
import type { ProductForPOS } from "@/features/mvp/pos/types";
import { ShoppingBag, CheckCircle, Package, TrendingUp } from "lucide-react";

interface PosClientProps {
  products: ProductForPOS[];
  transactionCount: number;
}

export function PosClient({ products, transactionCount }: PosClientProps) {
  return (
    <CartProvider>
      <PosContent products={products} transactionCount={transactionCount} />
    </CartProvider>
  );
}

function PosContent({ products, transactionCount }: PosClientProps) {
  const { itemCount, cart } = useCart();
  const targetTransactions = 3;
  const progressPercent = Math.min((transactionCount / targetTransactions) * 100, 100);
  const mvpComplete = transactionCount >= targetTransactions;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col -m-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 p-3">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} products available
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          {/* Transaction Progress */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-2.5">
            <div className={`rounded-full p-1.5 ${mvpComplete ? "bg-green-500" : "bg-muted"}`}>
              <CheckCircle className={`h-4 w-4 ${mvpComplete ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-medium">
                <span className={`text-lg font-bold ${mvpComplete ? "text-green-600" : ""}`}>
                  {transactionCount}
                </span>
                <span className="text-muted-foreground">/{targetTransactions}</span>
              </p>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                <div
                  className={`h-full transition-all duration-500 ${mvpComplete ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hidden lg:flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-2.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Today's Sales</p>
              <p className="text-sm font-bold">{transactionCount} orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Product Grid */}
        <div className="flex-1 overflow-hidden p-6 bg-muted/20">
          <ProductGrid products={products} />
        </div>

        {/* Cart Sidebar */}
        <div className="w-[380px] border-l bg-card p-5 flex flex-col">
          <Cart />
        </div>
      </div>

      {/* MVP Validation Footer */}
      <div className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Products:</span>
              <span className="font-bold">{products.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cart:</span>
              <span className="font-bold">{itemCount} items</span>
            </div>
            {cart.total > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">Rp {cart.total.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
            mvpComplete
              ? "bg-green-500/10 text-green-600"
              : "bg-amber-500/10 text-amber-600"
          }`}>
            {mvpComplete ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">MVP Target Reached!</span>
              </>
            ) : (
              <>
                <span className="font-medium">
                  {targetTransactions - transactionCount} more transactions needed
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
