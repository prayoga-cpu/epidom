import type { PosOrderItemDisplay } from "../../types/pos.types";

export type KdsDepartment = "KITCHEN" | "BAR";

/** Items with no department set (unlinked to a MenuItem, or a MenuItem never
 * assigned one in Data/Menu) default to Kitchen rather than disappearing
 * from both stations. */
export function itemDepartment(item: PosOrderItemDisplay): KdsDepartment {
  return item.menuItem?.department === "BAR" ? "BAR" : "KITCHEN";
}
