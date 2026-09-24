import type { PosMenuItem } from "../types/pos.types";

/**
 * The POS menu's Food / Drink(/ custom line) tabs. They are the item's
 * department under another name: Kitchen is sold as "Food" and Bar as "Drink",
 * because that is how a cashier looks for an item, while the Back Office keeps
 * "Kitchen / Food" and "Bar / Drink" since the same field also routes the line
 * to the kitchen or bar ticket. "CUSTOM" is the optional second product line
 * (see the /pos/menu route), not a stored department.
 */
export type PosMenuDepartment = "KITCHEN" | "BAR" | "CUSTOM";

/**
 * Whether an item belongs under a tab (null = All). A BOTH item is made in the
 * kitchen and the bar, so it shows under Food and under Drink; it is never part
 * of the custom line, which only holds its own sentinel.
 */
export function matchesMenuDepartment(
  itemDepartment: PosMenuItem["department"],
  selected: PosMenuDepartment | null
): boolean {
  if (selected === null) return true;
  if (itemDepartment === selected) return true;
  return itemDepartment === "BOTH" && selected !== "CUSTOM";
}
