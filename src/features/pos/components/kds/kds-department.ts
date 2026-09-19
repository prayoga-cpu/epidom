import type { PosOrderItemDisplay } from "../../types/pos.types";

export type KdsDepartment = "KITCHEN" | "BAR";

/** Which KDS station a line belongs to, or null when it belongs to neither.
 *
 * CUSTOM-productLine items (the optional second product line — see
 * Product.productLine) have no kitchen/bar prep step at all and return null so
 * they never enter either station.
 *
 * A line with NO MenuItem takes its prep area from the frozen
 * `OrderItem.department` instead — that's the POS "Custom Item" (an ad-hoc
 * line the cashier typed, unrelated to Product.productLine despite the shared
 * word), whose department the cashier chose in the dialog. A Custom Item with
 * no department means "no prep area", so it gets no ticket and was already
 * created SERVED (see resolveInitialOrderItemStatus). A non-custom line with
 * neither a MenuItem nor a department keeps the historical Kitchen default,
 * rather than disappearing from both stations. */
export function itemDepartment(item: PosOrderItemDisplay): KdsDepartment | null {
  if (item.menuItem?.product?.productLine === "CUSTOM") return null;

  if (!item.menuItem) {
    if (item.department === "BAR") return "BAR";
    // BOTH has no dedicated station; it prints to the kitchen like every
    // other non-bar line.
    if (item.department === "KITCHEN" || item.department === "BOTH") return "KITCHEN";
    return item.isCustom ? null : "KITCHEN";
  }

  return item.menuItem.department === "BAR" ? "BAR" : "KITCHEN";
}
