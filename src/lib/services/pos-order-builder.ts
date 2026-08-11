import { prisma } from "@/lib/prisma";
import type { OrderStatus, OrderItemStatus, PaymentMethod } from "@prisma/client";
import type { CreatePosOrderInput, SelectedOptionInput } from "@/lib/validation/pos.schemas";
import { deductStockForOrder } from "./stock-deduction.service";
import { productionBatchService } from "./production-batch.service";
import { resolveInitialOrderItemStatus } from "./order-status.helpers";

/**
 * The order's status the moment it's placed — CONFIRMED normally (goes to
 * the kitchen/bar queue, i.e. the Active Queue), but DELIVERED outright when
 * the store has turned the Active Queue off (kitchenDisplayEnabled: false),
 * since there's no production stage or queue left to pass through. Every
 * payment method, including PAY_LATER and any online gateway method still
 * awaiting confirmation, resolves the same way: production isn't gated on
 * payment — an unpaid order is tracked via paymentStatus and followed up on
 * with Mark as Paid, not by holding it out of the kitchen queue. Shared by
 * order creation (POS + storefront) and finalize so all three settlement
 * paths agree on what "placed" means for a given store.
 */
export function resolveSettledOrderStatus(
  method: PaymentMethod,
  kitchenDisplayEnabled: boolean
): OrderStatus {
  if (!kitchenDisplayEnabled) return "DELIVERED";
  return "CONFIRMED";
}

/**
 * Side effects of an order landing on DELIVERED outside the normal KDS
 * hand-off — i.e. resolveSettledOrderStatus returned DELIVERED directly
 * because the store has the kitchen display off — mirrors what the PATCH
 * /pos/orders/[orderId] route does when a cashier manually marks an order
 * delivered. Stock deduction is idempotent, so this is safe to call even if
 * something upstream already ran it (e.g. a payment webhook's defensive
 * retry).
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
  // SERVED for CUSTOM-productLine items (no prep step), PENDING otherwise —
  // see resolveInitialOrderItemStatus.
  initialStatus: OrderItemStatus;
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
    include: {
      product: { select: { productLine: true } },
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
      initialStatus: resolveInitialOrderItemStatus(menuItem.product?.productLine),
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);

  return { orderItems, subtotal };
}
