/**
 * Sentinel category name for menu items with no category assigned. A stable
 * (locale-independent) value rather than a display string like "Uncategorized"
 * so the POS menu API — which has no access to the cashier's UI locale — can
 * emit it directly; the client translates it (common.uncategorized) at render
 * time via t().
 */
export const UNCATEGORIZED_CATEGORY = "__uncategorized__";
