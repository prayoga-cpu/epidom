/**
 * Sentinel category name for menu items with no category assigned. A stable
 * (locale-independent) value rather than a display string like "Uncategorized"
 * so the POS menu API — which has no access to the cashier's UI locale — can
 * emit it directly; the client translates it (common.uncategorized) at render
 * time via t().
 */
export const UNCATEGORIZED_CATEGORY = "__uncategorized__";

/**
 * `error.details.reason` on the 422 a checkout / Save Bill gets back when cart
 * lines point at menu items that are gone or switched off. `details.items`
 * lists them as `{ menuItemId, name }`. The till matches on this to repair the
 * cart (features/pos/lib/cart-repair.ts) instead of only showing the message.
 */
export const ITEMS_UNAVAILABLE_REASON = "ITEMS_UNAVAILABLE";
