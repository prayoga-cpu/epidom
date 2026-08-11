import type { PosOrderItemDisplay } from "../../types/pos.types";

export type KdsDepartment = "KITCHEN" | "BAR";

/** Items with no department set (unlinked to a MenuItem, or a MenuItem never
 * assigned one in Data/Menu) default to Kitchen rather than disappearing
 * from both stations. CUSTOM-productLine items (the optional second product
 * line — see Product.productLine) have no kitchen/bar prep step at all and
 * return null so they never enter either KDS station. */
export function itemDepartment(item: PosOrderItemDisplay): KdsDepartment | null {
  if (item.menuItem?.product?.productLine === "CUSTOM") return null;
  return item.menuItem?.department === "BAR" ? "BAR" : "KITCHEN";
}
