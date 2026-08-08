import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@prisma/client";
import type { CreatePosOrderInput, SelectedOptionInput } from "@/lib/validation/pos.schemas";
import { deductStockForOrder } from "./stock-deduction.service";
import { productionBatchService } from "./production-batch.service";

/**
 * Whether this order is settled the instant the cashier hits Confirm. The
 * POS is a cashier-attended counter, not a self-checkout: for every method
 * except PAY_LATER, payment has already changed hands in person (cash
 * counted, a card tapped on a separate terminal, a QRIS/e-wallet scan the
 * cashier watched happen) by the time Confirm is pressed — there's no online
 * payment gateway step to wait on for any of them. Only PAY_LATER is
 * deliberately deferred. (The storefront's self-checkout flow is different —
 * see /api/public/orders, which has its own initiatePayment() call since a
 * customer paying alone online genuinely does need to complete a real
 * payment step.) Shared by order creation and finalize so the two routes
 * can't drift.
 */
export function skipsOnlinePayment(method: PaymentMethod): boolean {
  return method !== "PAY_LATER";
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

/**
 * Companion to deliverOrderImmediately for the opposite branch: an order
 * that just landed on CONFIRMED (going to the kitchen/bar queue, stock not
 * deducted yet — see stock-deduction.service.ts's deferred-to-DELIVERED
 * design). Auto-drafts any ORDER_SHORTFALL production batches this order
 * needs — see ProductionBatchService.draftShortfallBatchesForOrder — so
 * they're visible on the KDS board from the start. Never blocks order
 * creation on failure, same as deliverOrderImmediately.
 */
export async function draftShortfallBatchesForConfirmedOrder(
  orderId: string,
  storeId: string
): Promise<void> {
  try {
    await productionBatchService.draftShortfallBatchesForOrder(orderId, storeId);
  } catch (err) {
    console.error("[SHORTFALL_PRODUCTION] Failed to draft batches:", err);
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
  // Dedupe: the cart can list the same menu item on multiple lines (e.g. two
  // orders of the same drink with different notes), and Prisma's `id: { in }`
  // only ever returns one row per unique id — comparing against the raw,
  // possibly-repeating items array would then falsely flag available items.
  const uniqueMenuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: uniqueMenuItemIds },
      storefront: { storeId },
      isAvailable: true,
    },
  });

  if (menuItems.length !== uniqueMenuItemIds.length) {
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
