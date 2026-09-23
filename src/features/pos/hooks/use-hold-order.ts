import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { cartItemsToWireLines } from "../lib/cart-wire";
import type { CartDiscountSource, CartItem } from "../types/pos.types";

export interface HoldOrderInput {
  items: CartItem[];
  orderType: "DINE_IN" | "TAKEAWAY";
  /** Pax, DINE_IN only — carried through to finalize so a held dine-in order
   * keeps the guest count the cashier already entered. */
  guestCount?: number;
  tableId?: string;
  tableNumber?: string;
  customerName?: string;
  /** The Customer attached to the bill. The server persists it so resuming the
   * bill restores who it was for. Omitting it on a re-save detaches the customer. */
  customerId?: string;
  /** The attached customer's phone, so a resumed bill can still send a receipt. */
  customerPhone?: string;
  /**
   * The cart's primary discount. Only a manual amount and a preset survive a
   * Save Bill — the server persists those two; a coupon (which spends a use)
   * and points (which burn balance) only settle at placement, so they are
   * deliberately not sent here.
   */
  discount?: CartDiscountSource | null;
  notes?: string;
  shiftId?: string;
  /** Set when re-holding an already-held order in place, instead of creating a duplicate. */
  orderId?: string;
}

/** The slice of the cart store a Save Bill reads. */
export interface CartHoldSource {
  items: CartItem[];
  orderType: "DINE_IN" | "TAKEAWAY";
  guestCount: number;
  tableNumber: string;
  customer: { id: string; name: string; phone?: string | null } | null;
  discountSource: CartDiscountSource | null;
  resumingOrderId: string | null;
}

/**
 * Cart → hold input, in ONE place: Save Bill and Merge Bill (which saves the
 * working cart first to get a target id) must persist exactly the same thing.
 *
 * Pax only goes with dine-in (the server nulls it otherwise). An attached
 * customer supplies both `customerId` and the display name; `label` is the
 * cashier's free-text name for a walk-in bill ("Budi") and only applies when
 * nobody is attached.
 */
export function cartToHoldInput(
  cart: CartHoldSource,
  extra: { shiftId?: string; notes?: string; label?: string; tableNumber?: string } = {}
): HoldOrderInput {
  return {
    items: cart.items,
    orderType: cart.orderType,
    guestCount: cart.orderType === "DINE_IN" ? cart.guestCount : undefined,
    // The Save Bill dialog lets the cashier correct the table, so it wins over the cart's.
    tableNumber: (extra.tableNumber ?? cart.tableNumber).trim() || undefined,
    customerId: cart.customer?.id,
    customerPhone: cart.customer?.phone ?? undefined,
    customerName: cart.customer?.name ?? (extra.label?.trim() || undefined),
    discount: cart.discountSource,
    notes: extra.notes?.trim() || undefined,
    shiftId: extra.shiftId,
    orderId: cart.resumingOrderId ?? undefined,
  };
}

/** What POST /pos/orders/hold answers with (both fields are all this UI reads). */
export interface HoldOrderResult {
  orderId: string;
  orderNumber: string;
}

/**
 * The wire body for POST /pos/orders/hold. Exported so the mapping — custom
 * lines, the manual-vs-preset discount split — is unit-testable without a
 * network.
 *
 * A manual discount goes as amount + reason. A preset goes as its id ONLY: the
 * server re-prices it from the rule, so the client's preview amount is never
 * trusted (same contract as checkout).
 */
export function buildHoldBody(input: HoldOrderInput) {
  const discount = input.discount ?? null;
  return {
    items: cartItemsToWireLines(input.items),
    orderType: input.orderType,
    guestCount: input.guestCount,
    tableId: input.tableId,
    tableNumber: input.tableNumber,
    customerName: input.customerName,
    customerId: input.customerId,
    customerPhone: input.customerPhone,
    ...(discount?.kind === "manual"
      ? { discountAmount: discount.amount, discountReason: discount.reason }
      : {}),
    ...(discount?.kind === "preset" ? { presetId: discount.presetId } : {}),
    notes: input.notes,
    shiftId: input.shiftId,
    orderId: input.orderId,
  };
}

/**
 * Park the current cart aside as a HELD order (or update one in place, if
 * `orderId` is passed — resume, edit, hold again). Mirrors
 * useUpdateOrderStatus's cache-invalidation shape.
 */
export function useHoldOrder(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HoldOrderInput) =>
      apiClient.post<HoldOrderResult>(`/stores/${storeId}/pos/orders/hold`, buildHoldBody(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos", "orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["pos", "order-history", storeId], exact: false });
    },
  });
}
