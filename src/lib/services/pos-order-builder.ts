import { prisma } from "@/lib/prisma";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";

/** Thrown when one or more requested menu items are missing/unavailable — callers map this to a 422. */
export class OrderBuildError extends Error {}

export interface BuiltOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
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
    throw new OrderBuildError("One or more menu items are unavailable or not found");
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const orderItems: BuiltOrderItem[] = items.map((i) => {
    const menuItem = menuItemMap.get(i.menuItemId)!;
    const modifierTotal = (i.modifierSelections ?? []).reduce((sum, m) => sum + m.priceAdd, 0);
    const unitPrice = Number(menuItem.price) + modifierTotal;
    const total = unitPrice * i.quantity;
    return {
      menuItemId: i.menuItemId,
      name: menuItem.name,
      quantity: i.quantity,
      unit: "pcs",
      unitPrice,
      total,
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);

  return { orderItems, subtotal };
}
