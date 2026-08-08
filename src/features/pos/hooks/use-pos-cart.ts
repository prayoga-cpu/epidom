import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartModifier } from "../types/pos.types";
import { nanoid } from "@/lib/utils/nanoid";
import { computeOrderCharges, type ResolvedFinanceSettings } from "@/lib/finance/order-charges";

const DEFAULT_FINANCE_SETTINGS: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

interface PosCartState {
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  total: number;
  /** The store's resolved tax/service-charge settings — set once by the POS
   * shell after fetching them, so the cart preview matches what the server
   * will actually freeze onto the order. Payment method (and therefore the
   * processing fee) isn't known yet at cart-building time and doesn't affect
   * the total the customer pays, so it's never part of this preview. */
  financeSettings: ResolvedFinanceSettings;
  /** Set while the cart holds a resumed HELD order — cleared by clearCart(). */
  resumingOrderId: string | null;
  addItem: (
    menuItemId: string,
    name: string,
    unitPrice: number,
    quantity?: number,
    modifiers?: CartModifier[],
    imageUrl?: string | null,
    notes?: string
  ) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  /** Reconfigure an existing line's modifiers/note in place (edit affordance
   * in the cart) without the remove+re-add that addItem's merge-by-identity
   * would otherwise require. */
  updateItemOptions: (id: string, modifiers: CartModifier[], notes?: string) => void;
  clearCart: () => void;
  setResumingOrderId: (id: string | null) => void;
  setFinanceSettings: (settings: ResolvedFinanceSettings) => void;
  /** amount: null clears the discount entirely (also clearing the reason). */
  setDiscount: (amount: number | null, reason?: string) => void;
  /**
   * Loads items reconstructed from a HELD order directly, bypassing
   * addItem()'s same-menuItem+modifiers merge — resumed items always carry
   * modifiers: [] (never persisted on OrderItem), so feeding them through
   * addItem() could silently merge two originally-distinct lines and drop
   * one line's price.
   */
  hydrateFromOrder: (items: CartItem[], resumingOrderId: string) => void;
}

const calculateTotals = (
  items: CartItem[],
  settings: ResolvedFinanceSettings,
  discountAmount: number
) => {
  const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  // Payment method isn't chosen yet — processing fee never affects the cart
  // total (the merchant absorbs it), so it's forced off here.
  const charges = computeOrderCharges({
    itemsTotal,
    discountAmount,
    paymentMethod: "CASH",
    settings: { ...settings, processingFeeEnabled: false },
  });
  return {
    subtotal: charges.subtotal,
    tax: charges.tax,
    serviceCharge: charges.serviceCharge,
    // Re-clamped to itemsTotal by computeOrderCharges — reflects it back so
    // the displayed discount line never outlives a cart that shrank below it
    // (e.g. a line item removed after the discount was applied).
    discountAmount: charges.discountAmount,
    total: charges.total,
  };
};

export const usePosCart = create<PosCartState>()(
  persist(
    (set: any, get: any) => ({
      items: [] as CartItem[],
      subtotal: 0,
      tax: 0,
      serviceCharge: 0,
      discountAmount: 0,
      discountReason: null as string | null,
      total: 0,
      financeSettings: DEFAULT_FINANCE_SETTINGS,
      resumingOrderId: null as string | null,

      addItem: (menuItemId, name, unitPrice, quantity = 1, modifiers = [], imageUrl, notes) => {
        const { items, financeSettings, discountAmount } = get();

        // Check if identical item (same ID, modifiers, and note) already
        // exists — a different note makes it a distinct line even if the
        // modifiers match, since it carries its own special instruction.
        const existingItemIndex = items.findIndex(
          (i: any) =>
            i.menuItemId === menuItemId &&
            JSON.stringify(i.modifiers) === JSON.stringify(modifiers) &&
            (i.notes || "") === (notes || "")
        );

        let newItems;
        if (existingItemIndex >= 0) {
          // Increment quantity
          newItems = [...items];
          const item = newItems[existingItemIndex];
          const newQuantity = item.quantity + quantity;
          const modifierTotal = item.modifiers.reduce(
            (sum: number, m: any) => sum + m.priceAdjustment,
            0
          );
          newItems[existingItemIndex] = {
            ...item,
            quantity: newQuantity,
            lineTotal: (item.unitPrice + modifierTotal) * newQuantity,
          };
        } else {
          // Add new item
          const modifierTotal = modifiers.reduce((sum: number, m: any) => sum + m.priceAdjustment, 0);
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
              notes,
              lineTotal,
              imageUrl,
            },
          ];
        }

        const totals = calculateTotals(newItems, financeSettings, discountAmount);
        set({ items: newItems, ...totals });
      },

      removeItem: (id: string) => {
        const { items, financeSettings, discountAmount } = get();
        const newItems = items.filter((i: any) => i.id !== id);
        const totals = calculateTotals(newItems, financeSettings, discountAmount);
        set({ items: newItems, ...totals });
      },

      updateQuantity: (id: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const { items, financeSettings, discountAmount } = get();
        const newItems = items.map((item: any) => {
          if (item.id === id) {
            const modifierTotal = item.modifiers.reduce(
              (sum: number, m: any) => sum + m.priceAdjustment,
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

        const totals = calculateTotals(newItems, financeSettings, discountAmount);
        set({ items: newItems, ...totals });
      },

      updateItemOptions: (id: string, modifiers: CartModifier[], notes?: string) => {
        const { items, financeSettings, discountAmount } = get();
        const newItems = items.map((item: any) => {
          if (item.id !== id) return item;
          const modifierTotal = modifiers.reduce((sum: number, m: any) => sum + m.priceAdjustment, 0);
          return {
            ...item,
            modifiers,
            notes,
            lineTotal: (item.unitPrice + modifierTotal) * item.quantity,
          };
        });
        const totals = calculateTotals(newItems, financeSettings, discountAmount);
        set({ items: newItems, ...totals });
      },

      clearCart: () => {
        set({
          items: [],
          subtotal: 0,
          tax: 0,
          serviceCharge: 0,
          discountAmount: 0,
          discountReason: null,
          total: 0,
          resumingOrderId: null,
        });
      },

      setResumingOrderId: (id: string | null) => {
        set({ resumingOrderId: id });
      },

      setFinanceSettings: (settings: ResolvedFinanceSettings) => {
        const { items, discountAmount } = get();
        const totals = calculateTotals(items, settings, discountAmount);
        set({ financeSettings: settings, ...totals });
      },

      setDiscount: (amount: number | null, reason?: string) => {
        const { items, financeSettings } = get();
        const totals = calculateTotals(items, financeSettings, amount ?? 0);
        set({
          discountReason: amount ? (reason ?? null) : null,
          ...totals,
        });
      },

      hydrateFromOrder: (items: CartItem[], resumingOrderId: string) => {
        const { financeSettings, discountAmount } = get();
        const totals = calculateTotals(items, financeSettings, discountAmount);
        set({ items, resumingOrderId, ...totals });
      },
    }),
    {
      name: "epidom-pos-cart", // persist cart in localStorage
    }
  )
);
