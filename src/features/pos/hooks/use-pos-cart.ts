import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CartCustomer,
  CartDiscountSource,
  CartItem,
  CartModifier,
  DraftTender,
} from "../types/pos.types";
import { nanoid } from "@/lib/utils/nanoid";
import { computeOrderCharges, type ResolvedFinanceSettings } from "@/lib/finance/order-charges";
import {
  buildDiscountReason,
  composeOrderDiscount,
  computeRuleDiscount,
  type LoyaltyRules,
} from "@/lib/finance/discounts";

const DEFAULT_FINANCE_SETTINGS: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

export type CartOrderType = "DINE_IN" | "TAKEAWAY";

export interface CustomItemInput {
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  /** Prep area; null/omitted = none (the line is served immediately). */
  department?: "KITCHEN" | "BAR" | null;
}

/** State restored when a saved (HELD) bill is resumed. All optional. */
export interface ResumeExtras {
  orderType?: CartOrderType;
  guestCount?: number;
  tableNumber?: string;
  customer?: CartCustomer | null;
  discountSource?: CartDiscountSource | null;
}

interface PosCartState {
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  /** Total discount = primary (manual/preset/coupon) + points value. What checkout, hold and receipts read. */
  discountAmount: number;
  discountReason: string | null;
  /** The manual/preset/coupon part of `discountAmount`. */
  primaryDiscountAmount: number;
  /** The points-redemption part of `discountAmount`. */
  pointsDiscountAmount: number;
  /** Points that will really be burned — `redeemPoints` clamped to what's payable. */
  pointsRedeemed: number;
  total: number;
  /** null = no manual/preset/coupon discount. See CartDiscountSource. */
  discountSource: CartDiscountSource | null;
  /** Points the cashier asked to redeem; needs `customer`. Clamped into `pointsRedeemed`. */
  redeemPoints: number;
  /** The store's loyalty rules, set by the POS shell; null/disabled = points do nothing. */
  loyaltyRules: LoyaltyRules | null;
  /** Optional customer attached to this sale. */
  customer: CartCustomer | null;
  /** Owned by the cart (not the checkout dialog) so Save Bill and checkout inherit it. */
  orderType: CartOrderType;
  guestCount: number;
  tableNumber: string;
  /** Split-payment tender rows, persisted so a reload doesn't lose them. Cleared by clearCart. */
  draftTenders: DraftTender[];
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
  /** Adds an ad-hoc line (no MenuItem). Never merges with another line. */
  addCustomItem: (input: CustomItemInput) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  /** Reconfigure an existing line's modifiers/note in place (edit affordance
   * in the cart) without the remove+re-add that addItem's merge-by-identity
   * would otherwise require. */
  updateItemOptions: (id: string, modifiers: CartModifier[], notes?: string) => void;
  /**
   * Take quantities off lines after they've been paid as a split bill — a line
   * whose remaining quantity reaches zero is removed. Recomputes once.
   */
  removeLines: (lines: Array<{ lineId: string; quantity: number }>) => void;
  clearCart: () => void;
  setResumingOrderId: (id: string | null) => void;
  setFinanceSettings: (settings: ResolvedFinanceSettings) => void;
  setLoyaltyRules: (rules: LoyaltyRules | null) => void;
  /** Manual discount. amount: null clears the discount entirely (also clearing the reason). */
  setDiscount: (amount: number | null, reason?: string) => void;
  /** Set (or with null clear) the manual/preset/coupon discount. */
  setDiscountSource: (source: CartDiscountSource | null) => void;
  setRedeemPoints: (points: number) => void;
  /** Attach/detach the customer. Changing customer resets any points redemption. */
  setCustomer: (customer: CartCustomer | null) => void;
  setOrderType: (orderType: CartOrderType) => void;
  setGuestCount: (guestCount: number) => void;
  setTableNumber: (tableNumber: string) => void;
  setDraftTenders: (tenders: DraftTender[]) => void;
  /**
   * Loads items reconstructed from a HELD order directly, bypassing
   * addItem()'s same-menuItem+modifiers merge — resumed items always carry
   * modifiers: [] (never persisted on OrderItem), so feeding them through
   * addItem() could silently merge two originally-distinct lines and drop
   * one line's price. Custom Items (menuItemId null) keep their own lines.
   */
  hydrateFromOrder: (items: CartItem[], resumingOrderId: string, extras?: ResumeExtras) => void;
}

interface PricingInput {
  items: CartItem[];
  financeSettings: ResolvedFinanceSettings;
  discountSource: CartDiscountSource | null;
  redeemPoints: number;
  loyaltyRules: LoyaltyRules | null;
  customer: CartCustomer | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const lineTotalFor = (unitPrice: number, modifiers: CartModifier[], quantity: number) =>
  round2(
    (unitPrice + modifiers.reduce((sum: number, m: CartModifier) => sum + m.priceAdjustment, 0)) *
      quantity
  );

/** What the primary discount takes off `itemsTotal` right now. */
function primaryAmountFor(source: CartDiscountSource | null, itemsTotal: number): number {
  if (!source) return 0;
  if (source.kind === "manual") return source.amount;
  // A coupon stops applying if the cart shrank under its minimum — the server
  // re-checks the same rule, so keeping it would only fail at checkout.
  if (source.kind === "coupon" && source.minSubtotal != null && itemsTotal < source.minSubtotal) {
    return 0;
  }
  return computeRuleDiscount({ type: source.type, value: source.value }, itemsTotal);
}

function sourceLabel(source: CartDiscountSource | null): string | null {
  if (!source) return null;
  if (source.kind === "manual") return source.reason ?? null;
  return source.kind === "preset" ? source.name : source.code;
}

const calculateTotals = (input: PricingInput) => {
  const { items, financeSettings, discountSource, redeemPoints, loyaltyRules, customer } = input;
  const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // Points need a customer to burn them from.
  const composed = composeOrderDiscount({
    itemsTotal,
    primaryAmount: primaryAmountFor(discountSource, itemsTotal),
    redeemPoints: customer ? redeemPoints : 0,
    rules: loyaltyRules,
  });

  // Payment method isn't chosen yet — processing fee never affects the cart
  // total (the merchant absorbs it), so it's forced off here.
  const charges = computeOrderCharges({
    itemsTotal,
    discountAmount: composed.discountAmount,
    paymentMethod: "CASH",
    settings: { ...financeSettings, processingFeeEnabled: false },
  });

  return {
    subtotal: charges.subtotal,
    tax: charges.tax,
    serviceCharge: charges.serviceCharge,
    // Re-clamped to itemsTotal by computeOrderCharges — reflects it back so
    // the displayed discount line never outlives a cart that shrank below it
    // (e.g. a line item removed after the discount was applied).
    discountAmount: charges.discountAmount,
    primaryDiscountAmount: composed.primaryAmount,
    pointsDiscountAmount: composed.pointsValue,
    pointsRedeemed: composed.pointsRedeemed,
    // Preview only: the server rebuilds the persisted reason from ids/codes.
    discountReason: buildDiscountReason([
      sourceLabel(discountSource),
      composed.pointsRedeemed > 0 ? `${composed.pointsRedeemed} pts` : null,
    ]) ?? null,
    total: charges.total,
  };
};

const EMPTY_CART = {
  items: [] as CartItem[],
  subtotal: 0,
  tax: 0,
  serviceCharge: 0,
  discountAmount: 0,
  discountReason: null as string | null,
  primaryDiscountAmount: 0,
  pointsDiscountAmount: 0,
  pointsRedeemed: 0,
  total: 0,
  discountSource: null as CartDiscountSource | null,
  redeemPoints: 0,
  customer: null as CartCustomer | null,
  orderType: "DINE_IN" as CartOrderType,
  guestCount: 1,
  tableNumber: "",
  draftTenders: [] as DraftTender[],
  resumingOrderId: null as string | null,
};

export const usePosCart = create<PosCartState>()(
  persist(
    (set: any, get: any) => {
      /** Merge `patch` into state and recompute every derived total from the result. */
      const apply = (patch: Partial<PosCartState>) => {
        const next = { ...get(), ...patch };
        set({ ...patch, ...calculateTotals(next) });
      };

      return {
        ...EMPTY_CART,
        loyaltyRules: null as LoyaltyRules | null,
        financeSettings: DEFAULT_FINANCE_SETTINGS,

        addItem: (menuItemId, name, unitPrice, quantity = 1, modifiers = [], imageUrl, notes) => {
          const { items } = get();

          // Check if identical item (same ID, modifiers, and note) already
          // exists — a different note makes it a distinct line even if the
          // modifiers match, since it carries its own special instruction.
          const existingItemIndex = items.findIndex(
            (i: CartItem) =>
              i.menuItemId === menuItemId &&
              JSON.stringify(i.modifiers) === JSON.stringify(modifiers) &&
              (i.notes || "") === (notes || "")
          );

          let newItems: CartItem[];
          if (existingItemIndex >= 0) {
            // Increment quantity
            newItems = [...items];
            const item = newItems[existingItemIndex];
            const newQuantity = item.quantity + quantity;
            newItems[existingItemIndex] = {
              ...item,
              quantity: newQuantity,
              lineTotal: lineTotalFor(item.unitPrice, item.modifiers, newQuantity),
            };
          } else {
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
                lineTotal: lineTotalFor(unitPrice, modifiers, quantity),
                imageUrl,
              },
            ];
          }

          apply({ items: newItems });
        },

        addCustomItem: ({ name, unitPrice, quantity, notes, department }) => {
          const { items } = get();
          apply({
            items: [
              ...items,
              {
                id: nanoid(),
                menuItemId: null,
                isCustom: true,
                name,
                unitPrice,
                quantity,
                modifiers: [],
                notes: notes || undefined,
                department: department ?? null,
                lineTotal: lineTotalFor(unitPrice, [], quantity),
              },
            ],
          });
        },

        removeItem: (id: string) => {
          apply({ items: get().items.filter((i: CartItem) => i.id !== id) });
        },

        updateQuantity: (id: string, quantity: number) => {
          if (quantity <= 0) {
            get().removeItem(id);
            return;
          }
          apply({
            items: get().items.map((item: CartItem) =>
              item.id === id
                ? {
                    ...item,
                    quantity,
                    lineTotal: lineTotalFor(item.unitPrice, item.modifiers, quantity),
                  }
                : item
            ),
          });
        },

        updateItemOptions: (id: string, modifiers: CartModifier[], notes?: string) => {
          apply({
            items: get().items.map((item: CartItem) =>
              item.id !== id
                ? item
                : {
                    ...item,
                    modifiers,
                    notes,
                    lineTotal: lineTotalFor(item.unitPrice, modifiers, item.quantity),
                  }
            ),
          });
        },

        removeLines: (lines) => {
          const byLine = new Map<string, number>();
          for (const l of lines) byLine.set(l.lineId, (byLine.get(l.lineId) ?? 0) + l.quantity);

          const items: CartItem[] = [];
          for (const item of get().items as CartItem[]) {
            const take = byLine.get(item.id) ?? 0;
            const left = item.quantity - take;
            if (left <= 0) continue;
            items.push(
              take === 0
                ? item
                : { ...item, quantity: left, lineTotal: lineTotalFor(item.unitPrice, item.modifiers, left) }
            );
          }
          apply({ items });
        },

        clearCart: () => {
          set({ ...EMPTY_CART });
        },

        setResumingOrderId: (id: string | null) => {
          set({ resumingOrderId: id });
        },

        setFinanceSettings: (settings: ResolvedFinanceSettings) => {
          apply({ financeSettings: settings });
        },

        setLoyaltyRules: (rules: LoyaltyRules | null) => {
          apply({ loyaltyRules: rules });
        },

        setDiscount: (amount: number | null, reason?: string) => {
          apply({
            discountSource: amount && amount > 0 ? { kind: "manual", amount, reason } : null,
          });
        },

        setDiscountSource: (source: CartDiscountSource | null) => {
          apply({ discountSource: source });
        },

        setRedeemPoints: (points: number) => {
          apply({ redeemPoints: Math.max(Math.floor(points) || 0, 0) });
        },

        setCustomer: (customer: CartCustomer | null) => {
          const changed = (get().customer?.id ?? null) !== (customer?.id ?? null);
          apply({ customer, ...(changed ? { redeemPoints: 0 } : {}) });
        },

        setOrderType: (orderType: CartOrderType) => set({ orderType }),

        setGuestCount: (guestCount: number) =>
          set({ guestCount: Math.min(Math.max(Math.floor(guestCount) || 1, 1), 99) }),

        setTableNumber: (tableNumber: string) => set({ tableNumber }),

        setDraftTenders: (tenders: DraftTender[]) => set({ draftTenders: tenders }),

        hydrateFromOrder: (items: CartItem[], resumingOrderId: string, extras: ResumeExtras = {}) => {
          apply({
            items,
            resumingOrderId,
            ...(extras.orderType !== undefined ? { orderType: extras.orderType } : {}),
            ...(extras.guestCount !== undefined ? { guestCount: extras.guestCount } : {}),
            ...(extras.tableNumber !== undefined ? { tableNumber: extras.tableNumber } : {}),
            ...(extras.customer !== undefined
              ? { customer: extras.customer, redeemPoints: 0 }
              : {}),
            ...(extras.discountSource !== undefined
              ? { discountSource: extras.discountSource }
              : {}),
          });
        },
      };
    },
    {
      name: "epidom-pos-cart", // persist cart in localStorage
      version: 1,
      // v0 carts stored a bare discountAmount/discountReason and had no
      // customer / order type / structured discount. Carry a live manual
      // discount across, so a cart left open over the upgrade keeps its price.
      migrate: (persisted: any, version: number) => {
        if (persisted && version < 1) {
          const amount = Number(persisted.discountAmount) || 0;
          persisted.discountSource =
            amount > 0
              ? { kind: "manual", amount, reason: persisted.discountReason ?? undefined }
              : null;
        }
        return persisted;
      },
    }
  )
);
