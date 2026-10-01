import { ApiClientError } from "@/lib/api/client";
import { ITEMS_UNAVAILABLE_REASON } from "@/lib/constants/pos";
import { lineTotalFor } from "../hooks/use-pos-cart";
import type { CartItem, PosMenuCategory, PosMenuItem } from "../types/pos.types";
import { isCustomLine } from "./cart-wire";

/**
 * What to do about a cart the server refused because some of its lines point
 * at menu items that are gone or switched off.
 *
 * A cart outlives the menu it was built from: it is persisted on the device, a
 * saved bill is resumed days later, and a product that is deleted and imported
 * again comes back as a NEW menu item with a new id. Until now the cashier got
 * a toast naming the items and had to work out the rest; this turns the
 * server's list into a fixed cart.
 */

/** A cart line the server refused, as it names it in the 422's `details.items`. */
export interface UnavailableLine {
  menuItemId: string;
  name: string;
}

/** The refused lines, or null when `error` is any other failure. */
export function unavailableLinesFromError(error: unknown): UnavailableLine[] | null {
  if (!(error instanceof ApiClientError)) return null;
  const details = error.response.error.details;
  if (!details || Array.isArray(details) || details.reason !== ITEMS_UNAVAILABLE_REASON) {
    return null;
  }
  const items = Array.isArray(details.items) ? details.items : [];
  const lines = items.filter(
    (item): item is UnavailableLine =>
      !!item &&
      typeof item === "object" &&
      typeof (item as UnavailableLine).menuItemId === "string" &&
      typeof (item as UnavailableLine).name === "string"
  );
  return lines.length > 0 ? lines : null;
}

export interface CartRepair {
  /** The cart's lines once repaired. */
  items: CartItem[];
  /** Lines moved onto the menu item that now carries their name. */
  relinked: Array<{ name: string; priceChanged: boolean }>;
  /** Names of the lines taken out: nothing sellable carries that name now. */
  removed: string[];
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Repair `items` against the current `menu`.
 *
 * A refused line is RE-LINKED when exactly one sellable menu item has its name
 * (the "deleted and re-created" case): it takes that item's id and its current
 * price, keeping the quantity, options and note. Anything else is REMOVED,
 * including a name that matches several items, where guessing could charge the
 * customer for the wrong one. Lines the server did not refuse are never touched
 * — the menu the till holds is not proof of what the server will accept (an
 * item hidden from the cashier screen is still sellable on a resumed bill).
 */
export function repairCartItems(
  items: CartItem[],
  unavailable: UnavailableLine[],
  menu: PosMenuCategory[]
): CartRepair {
  const refused = new Set(unavailable.map((line) => line.menuItemId));

  const candidates = new Map<string, PosMenuItem[]>();
  for (const category of menu) {
    for (const item of category.items) {
      if (!item.isAvailable || refused.has(item.id)) continue;
      const key = nameKey(item.name);
      candidates.set(key, [...(candidates.get(key) ?? []), item]);
    }
  }

  const repaired: CartItem[] = [];
  const relinked: CartRepair["relinked"] = [];
  const removed: string[] = [];

  for (const line of items) {
    if (isCustomLine(line) || !refused.has(line.menuItemId as string)) {
      repaired.push(line);
      continue;
    }

    const matches = candidates.get(nameKey(line.name)) ?? [];
    if (matches.length !== 1) {
      removed.push(line.name);
      continue;
    }

    const [replacement] = matches;
    relinked.push({ name: replacement.name, priceChanged: replacement.price !== line.unitPrice });
    repaired.push({
      ...line,
      menuItemId: replacement.id,
      name: replacement.name,
      unitPrice: replacement.price,
      imageUrl: replacement.imageUrl ?? line.imageUrl,
      lineTotal: lineTotalFor(replacement.price, line.modifiers, line.quantity),
    });
  }

  return { items: repaired, relinked, removed: [...new Set(removed)] };
}
