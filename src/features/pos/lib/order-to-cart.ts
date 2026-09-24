import { POS_ONLINE_PLATFORMS, type PosOnlinePlatform } from "@/config/aggregator.config";
import type { ResumeExtras } from "../hooks/use-pos-cart";
import type {
  CartCustomer,
  CartItem,
  PosOrderDisplay,
  PosOrderItemDisplay,
} from "../types/pos.types";

/**
 * The order row GET /pos/orders (and /pos/orders/[orderId]) actually returns:
 * serializePosOrder spreads the whole Order, so these columns are on the wire
 * even though PosOrderDisplay doesn't declare them.
 */
export type ResumableOrder = PosOrderDisplay & {
  guestCount?: number | null;
  tableId?: string | null;
  discountAmount?: number | string | null;
  discountReason?: string | null;
};

/**
 * Held-order lines back into cart lines. Modifiers come from `selectedOptions`
 * (frozen at hold time); a Custom Item — or a line whose MenuItem has since been
 * deleted — has no menuItemId and stays its own line (`isCustom`), so it is
 * resubmitted as a custom line instead of failing the menu lookup.
 */
export function orderItemsToCartItems(items: PosOrderItemDisplay[]): CartItem[] {
  return items.map((item) => {
    const menuItemId = item.menuItemId ?? null;
    const isCustom = item.isCustom === true || menuItemId === null;
    const department =
      item.department === "KITCHEN" || item.department === "BAR" ? item.department : null;
    return {
      id: item.id,
      menuItemId,
      name: item.menuItem?.name ?? item.name,
      // Number(...) defensively: these should already be plain numbers from
      // the API, but a Prisma Decimal that slips through unconverted
      // serializes as a *string*, which would silently turn every total
      // calculation downstream into string concatenation instead of addition.
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      modifiers: item.selectedOptions ?? [],
      notes: item.notes ?? undefined,
      lineTotal: Number(item.total),
      ...(isCustom ? { isCustom: true, department } : {}),
    };
  });
}

/**
 * A stand-in customer built from the order row alone, for when GET
 * /customers/[id] can't be reached (offline, deleted). Points and lifetime
 * spend are unknown, so they read 0 until the cart's customer row refreshes them.
 */
export function fallbackCustomerFromOrder(order: ResumableOrder): CartCustomer | null {
  if (!order.customerId) return null;
  return {
    id: order.customerId,
    name: order.customerName,
    phone: order.customerPhone ?? null,
    email: null,
    points: 0,
    lifetimeSpend: 0,
  };
}

/**
 * Everything a resumed bill puts back on the cart besides its lines.
 *
 * Every field is passed — even when the order has nothing for it — because
 * hydrateFromOrder only overwrites what it is given: resuming into a cart that
 * still holds the previous sale's table, guest count or customer would
 * otherwise leak them onto the resumed bill.
 *
 * The held discount comes back as a flat MANUAL discount (amount + reason),
 * whatever produced it. The server re-priced a preset when the bill was saved
 * and stored the result; a flat amount is exactly that number, and finalize
 * honors it as such. (A percent preset therefore stops re-pricing if the
 * resumed bill is edited — the same trade the server's held row makes.)
 */
export function buildResumeExtras(
  order: ResumableOrder,
  customer: CartCustomer | null
): ResumeExtras {
  const discount = Number(order.discountAmount ?? 0);
  const onlinePlatform = (POS_ONLINE_PLATFORMS as readonly string[]).includes(order.source)
    ? (order.source as PosOnlinePlatform)
    : null;
  return {
    // A bill saved under a delivery platform comes back under it; any other
    // DELIVERY (there is none from the till today) falls back to Dine In.
    orderType: onlinePlatform
      ? "DELIVERY"
      : order.orderType === "TAKEAWAY"
        ? "TAKEAWAY"
        : "DINE_IN",
    onlinePlatform,
    guestCount: order.guestCount && order.guestCount > 0 ? order.guestCount : 1,
    tableNumber: order.tableNumber ?? order.tableLabel ?? "",
    tableId: order.orderType === "DINE_IN" ? (order.tableId ?? null) : null,
    customer,
    discountSource:
      Number.isFinite(discount) && discount > 0
        ? { kind: "manual", amount: discount, reason: order.discountReason ?? undefined }
        : null,
  };
}
