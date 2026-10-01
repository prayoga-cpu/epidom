import { prisma } from "@/lib/prisma";
import type { OrderStatus, OrderItemStatus, PaymentMethod, Department } from "@prisma/client";
import {
  CUSTOM_ITEM_MAX_UNIT_PRICE,
  isCustomOrderItem,
  type CreatePosOrderInput,
  type SelectedOptionInput,
} from "@/lib/validation/pos.schemas";
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

/** A requested line the menu can no longer sell (deleted, or switched off). */
export interface UnavailableOrderLine {
  menuItemId: string;
  name: string;
}

/** Thrown when one or more requested menu items are missing/unavailable — callers map this to a 422. */
export class OrderBuildError extends Error {
  constructor(
    message: string,
    /** Set only for the unavailable-lines case, so the client can act on the exact lines. */
    readonly unavailable?: UnavailableOrderLine[]
  ) {
    super(message);
  }
}

export interface BuiltOrderItem {
  /** null for a POS Custom Item — an ad-hoc line with no MenuItem behind it. */
  menuItemId: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  notes?: string;
  selectedOptions?: SelectedOptionInput[];
  /** True only for a Custom Item. Unrelated to Product.productLine = CUSTOM. */
  isCustom: boolean;
  /** Prep area persisted on the line itself; only ever set for a Custom Item,
   * since every ordinary line derives it from menuItem.department. */
  department: Department | null;
  // SERVED for CUSTOM-productLine items and for a Custom Item with no prep
  // area (no prep step either way), PENDING otherwise — see
  // resolveInitialOrderItemStatus.
  initialStatus: OrderItemStatus;
}

/**
 * Validate that every requested menu item exists, belongs to this store, and
 * is available, then reprice each line from the current menu (never trusts
 * client-sent prices). Shared by order creation, hold, and finalize so
 * pricing logic lives in exactly one place.
 *
 * Custom Items are the one exception to "never trust the client": they have no
 * menu row to reprice against, so the cashier's typed name/price ARE the
 * record. The Zod schema bounds both (≤80 chars, ≤ CUSTOM_ITEM_MAX_UNIT_PRICE)
 * because Order is an immutable ledger — a bad number here is permanent.
 *
 * `tolerant` is the offline-replay mode (see buildPosSettlement): the customer
 * already paid on a disconnected till and the queue drops an entry after 5
 * failed attempts, so a menu change made while the till was offline must not
 * reject the sale. An item that was merely switched off is still repriced from
 * its row; one that was deleted is recorded from the name and price the till
 * charged, with a warning for Order.notes.
 */
export async function validateAndBuildOrderItems(
  storeId: string,
  items: CreatePosOrderInput["items"],
  opts: { tolerant?: boolean } = {}
): Promise<{ orderItems: BuiltOrderItem[]; subtotal: number; warnings: string[] }> {
  const menuLines = items.filter((i) => !isCustomOrderItem(i));
  const warnings: string[] = [];

  // Dedupe: the cart can list the same menu item on multiple lines (e.g. two
  // orders of the same drink with different notes), and Prisma's `id: { in }`
  // only ever returns one row per unique id — comparing against the raw,
  // possibly-repeating items array would then falsely flag available items.
  const uniqueMenuItemIds = [
    ...new Set(menuLines.map((i) => (i as { menuItemId: string }).menuItemId)),
  ];
  // Skip the round trip entirely for an all-Custom-Item sale (an ad-hoc bill
  // with nothing from the menu is a legitimate Luna-parity use case).
  const menuItems = uniqueMenuItemIds.length
    ? await prisma.menuItem.findMany({
        where: {
          id: { in: uniqueMenuItemIds },
          storefront: { storeId },
          // Must agree with GET /pos/menu, which is what put the line in the
          // cart. A CUSTOM-line item is always sellable at the till: its stored
          // isAvailable is only the storefront's "Show on Menu" switch, and the
          // menu route overrides it to true. Requiring the stored flag here
          // rejected a sale the cashier screen had offered as a normal tile.
          ...(!opts.tolerant && {
            OR: [{ isAvailable: true }, { product: { productLine: "CUSTOM" } }],
          }),
        },
        include: {
          product: { select: { productLine: true } },
        },
      })
    : [];

  if (menuItems.length !== uniqueMenuItemIds.length && !opts.tolerant) {
    const foundIds = new Set(menuItems.map((m) => m.id));
    // Name the exact items so the cashier knows what to remove, rather than a
    // vague "something is wrong" — this is the common case when a held order
    // is resumed after the menu changed (item deleted / made unavailable).
    const unavailable = new Map<string, UnavailableOrderLine>();
    for (const line of menuLines) {
      const { menuItemId } = line as { menuItemId: string };
      if (!foundIds.has(menuItemId)) unavailable.set(menuItemId, { menuItemId, name: line.name });
    }
    const lines = [...unavailable.values()];
    throw new OrderBuildError(
      `No longer available, remove from cart: ${lines.map((l) => l.name).join(", ")}`,
      lines
    );
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const orderItems: BuiltOrderItem[] = items.map((i) => {
    if (isCustomOrderItem(i)) {
      const unitPrice = i.unitPrice;
      const department = (i.department ?? null) as Department | null;
      return {
        menuItemId: null,
        name: i.name,
        quantity: i.quantity,
        unit: "pcs",
        unitPrice,
        total: unitPrice * i.quantity,
        notes: i.notes,
        selectedOptions: undefined,
        isCustom: true,
        department,
        initialStatus: resolveInitialOrderItemStatus(null, { isCustom: true, department }),
      };
    }

    const menuItem = menuItemMap.get(i.menuItemId);
    const modifierTotal = (i.selectedOptions ?? []).reduce((sum, m) => sum + m.priceAdjustment, 0);

    // Only reachable on a tolerant replay (the strict path threw above): the
    // row is gone, so the till's own name and price are the only record left.
    // No menuItemId, like any line whose MenuItem was deleted after the sale.
    if (!menuItem) {
      // Bounded like a Custom Item's price: nothing is left to reprice against.
      const unitPrice = Math.min(i.unitPrice + modifierTotal, CUSTOM_ITEM_MAX_UNIT_PRICE);
      warnings.push(`"${i.name}" was no longer on the menu; recorded at the price charged`);
      return {
        menuItemId: null,
        name: i.name,
        quantity: i.quantity,
        unit: "pcs",
        unitPrice,
        total: unitPrice * i.quantity,
        notes: i.notes,
        selectedOptions: i.selectedOptions,
        isCustom: true,
        department: null,
        initialStatus: resolveInitialOrderItemStatus(null, { isCustom: true, department: null }),
      };
    }

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
      isCustom: false,
      department: null,
      initialStatus: resolveInitialOrderItemStatus(menuItem.product?.productLine),
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);

  return { orderItems, subtotal, warnings: [...new Set(warnings)] };
}
