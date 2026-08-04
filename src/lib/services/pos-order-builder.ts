import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@prisma/client";
import type { CreatePosOrderInput, SelectedOptionInput } from "@/lib/validation/pos.schemas";
import { deductStockForOrder } from "./stock-deduction.service";

/**
 * Methods that need no online payment step: CASH is settled at the counter
 * immediately, PAY_LATER is deliberately deferred. Both send the order
 * straight to the kitchen (status CONFIRMED) instead of waiting on a
 * provider webhook, and neither should trigger initiatePayment(). Shared by
 * order creation and finalize so the two routes can't drift.
 */
export function skipsOnlinePayment(method: PaymentMethod): boolean {
  return method === "CASH" || method === "PAY_LATER";
}

/**
 * The order's status the moment payment is settled — CONFIRMED normally
 * (goes to the kitchen/bar queue), but DELIVERED outright when the store has
 * no kitchen/bar workflow to track (kitchenDisplayEnabled: false), since
 * there's no production stage left to pass through. Shared by order
 * creation, finalize, and the payment webhook so all three settlement paths
 * agree on what "paid" means for a given store.
 */
export function resolveSettledOrderStatus(
  method: PaymentMethod,
  kitchenDisplayEnabled: boolean
): OrderStatus {
  if (!skipsOnlinePayment(method)) return "PENDING";
  return kitchenDisplayEnabled ? "CONFIRMED" : "DELIVERED";
}

/**
 * Side effects of an order landing on DELIVERED outside the normal KDS
 * hand-off (i.e. resolveSettledOrderStatus returned DELIVERED directly, or
 * the payment webhook confirms a store with the kitchen display off) —
 * mirrors what the PATCH /pos/orders/[orderId] route does when a cashier
 * manually marks an order delivered. Stock deduction is idempotent, so this
 * is safe to call even if something upstream already ran it.
 */
export async function deliverOrderImmediately(orderId: string, storeId: string): Promise<void> {
  try {
    await deductStockForOrder(orderId, storeId);
  } catch (err) {
    console.error("[IMMEDIATE_DELIVERY] Stock deduction failed:", err);
  }
}

/** Thrown when one or more requested menu items are missing/unavailable — callers map this to a 422. */
export class OrderBuildError extends Error {}

export interface BuiltOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  notes?: string;
  selectedOptions?: SelectedOptionInput[];
}

/**
 * Validate that every requested menu item exists, belongs to this store, and
 * is available, then reprice each line from the current menu (never trusts
 * client-sent prices). Shared by order creation, hold, and finalize so
 * pricing logic lives in exactly one place.
 */
export async function validateAndBuildOrderItems(
  storeId: string,
  items: CreatePosOrderInput["items"]
): Promise<{ orderItems: BuiltOrderItem[]; subtotal: number }> {
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      storefront: { storeId },
      isAvailable: true,
    },
  });

  if (menuItems.length !== menuItemIds.length) {
    const foundIds = new Set(menuItems.map((m) => m.id));
    // Name the exact items so the cashier knows what to remove, rather than a
    // vague "something is wrong" — this is the common case when a held order
    // is resumed after the menu changed (item deleted / made unavailable).
    const missingNames = items.filter((i) => !foundIds.has(i.menuItemId)).map((i) => i.name);
    throw new OrderBuildError(`No longer available, remove from cart: ${missingNames.join(", ")}`);
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const orderItems: BuiltOrderItem[] = items.map((i) => {
    const menuItem = menuItemMap.get(i.menuItemId)!;
    const modifierTotal = (i.selectedOptions ?? []).reduce((sum, m) => sum + m.priceAdjustment, 0);
    const unitPrice = Number(menuItem.price) + modifierTotal;
    const total = unitPrice * i.quantity;
    return {
      menuItemId: i.menuItemId,
      name: menuItem.name,
      quantity: i.quantity,
      unit: "pcs",
      unitPrice,
      total,
      notes: i.notes,
      selectedOptions: i.selectedOptions,
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);

  return { orderItems, subtotal };
}
