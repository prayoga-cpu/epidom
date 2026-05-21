import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartModifier } from "../types/pos.types";
import { nanoid } from "@/lib/utils/nanoid";

interface PosCartState {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  addItem: (
    menuItemId: string,
    name: string,
    unitPrice: number,
    quantity?: number,
    modifiers?: CartModifier[],
    imageUrl?: string | null
  ) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const calculateTotals = (items: CartItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = 0; // Configurable per store later
  const total = subtotal + tax;
  return { subtotal, tax, total };
};

export const usePosCart = create<PosCartState>()(
  persist(
    (set: any, get: any) => ({
      items: [] as CartItem[],
      subtotal: 0,
      tax: 0,
      total: 0,

      addItem: (
        menuItemId,
        name,
        unitPrice,
        quantity = 1,
        modifiers = [],
        imageUrl
      ) => {
        const { items } = get();

        // Check if identical item (same ID and modifiers) already exists
        const existingItemIndex = items.findIndex(
          (i: any) =>
            i.menuItemId === menuItemId &&
            JSON.stringify(i.modifiers) === JSON.stringify(modifiers)
        );

        let newItems;
        if (existingItemIndex >= 0) {
          // Increment quantity
          newItems = [...items];
          const item = newItems[existingItemIndex];
          const newQuantity = item.quantity + quantity;
          const modifierTotal = item.modifiers.reduce(
            (sum: number, m: any) => sum + m.priceAdd,
            0
          );
          newItems[existingItemIndex] = {
            ...item,
            quantity: newQuantity,
            lineTotal: (item.unitPrice + modifierTotal) * newQuantity,
          };
        } else {
          // Add new item
          const modifierTotal = modifiers.reduce(
            (sum: number, m: any) => sum + m.priceAdd,
            0
          );
          const lineTotal = (unitPrice + modifierTotal) * quantity;
          newItems = [
            ...items,
            {
              id: nanoid(),
              menuItemId,
              name,
              unitPrice,
              quantity,
              modifiers,
              lineTotal,
              imageUrl,
            },
          ];
        }

        const totals = calculateTotals(newItems);
        set({ items: newItems, ...totals });
      },

      removeItem: (id: string) => {
        const { items } = get();
        const newItems = items.filter((i: any) => i.id !== id);
        const totals = calculateTotals(newItems);
        set({ items: newItems, ...totals });
      },

      updateQuantity: (id: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const { items } = get();
        const newItems = items.map((item: any) => {
          if (item.id === id) {
            const modifierTotal = item.modifiers.reduce(
              (sum: number, m: any) => sum + m.priceAdd,
              0
            );
            return {
              ...item,
              quantity,
              lineTotal: (item.unitPrice + modifierTotal) * quantity,
            };
          }
          return item;
        });

        const totals = calculateTotals(newItems);
        set({ items: newItems, ...totals });
      },

      clearCart: () => {
        set({ items: [], subtotal: 0, tax: 0, total: 0 });
      },
    }),
    {
      name: "epidom-pos-cart", // persist cart in localStorage
    }
  )
);
