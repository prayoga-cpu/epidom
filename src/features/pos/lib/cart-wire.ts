import type { CartItem, CartModifier } from "../types/pos.types";

/**
 * A cart line as it goes over the wire to POST /pos/orders/hold (and the
 * matching order routes): either an ordinary menu line, repriced server-side
 * from the menu, or a Custom Item, whose name and price the cashier typed.
 *
 * The two are told apart by the `custom: true` marker rather than by a null
 * `menuItemId` — the order schemas' regular-line branch requires a cuid there,
 * and an old-shape payload (no marker) must keep validating unchanged because
 * the offline queue persists raw payloads unversioned.
 */
export type WireOrderLine =
  | {
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      selectedOptions: CartModifier[];
      notes?: string;
    }
  | {
      custom: true;
      name: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      /** null = no prep area; the server starts such a line as SERVED. */
      department: "KITCHEN" | "BAR" | null;
    };

/** True for an ad-hoc line with no MenuItem behind it. */
export function isCustomLine(item: Pick<CartItem, "menuItemId" | "isCustom">): boolean {
  return item.isCustom === true || item.menuItemId == null || item.menuItemId === "";
}

export function cartItemsToWireLines(items: CartItem[]): WireOrderLine[] {
  return items.map((item): WireOrderLine => {
    if (isCustomLine(item)) {
      return {
        custom: true,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
        department: item.department ?? null,
      };
    }
    return {
      menuItemId: item.menuItemId as string,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      selectedOptions: item.modifiers,
      notes: item.notes,
    };
  });
}
