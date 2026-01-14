/**
 * MVP POS Cart Store
 *
 * React Context-based cart state for POS
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { CartItem, Cart, ProductForPOS } from "./types";

interface CartState {
  cart: Cart;
  addItem: (product: ProductForPOS, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
}

const emptyCart: Cart = {
  items: [],
  subtotal: 0,
  total: 0,
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: ProductForPOS, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);

      if (existing) {
        // Update quantity
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      // Add new item
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity,
          unitPrice: Number(product.sellingPrice),
          costPrice: Number(product.costPrice),
          unit: product.unit,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const cart = useMemo<Cart>(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    return {
      items,
      subtotal,
      total: subtotal, // No tax for MVP
    };
  }, [items]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
