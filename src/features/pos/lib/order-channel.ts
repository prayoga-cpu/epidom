import {
  isOnlinePlatformSource,
  ONLINE_PLATFORM_LABELS,
  type OnlinePlatformSource,
} from "@/config/aggregator.config";

type Translate = (key: string) => string;

/**
 * A delivery platform's name. Brands (GoFood, Uber Eats, …) are never
 * translated; "Other platform" is.
 */
export function onlinePlatformLabel(t: Translate, platform: OnlinePlatformSource): string {
  return platform === "OTHER_ONLINE"
    ? t("pos.onlinePlatform.other")
    : ONLINE_PLATFORM_LABELS[platform];
}

/**
 * How the till names a sale's type: Dine In, Take Away, or — for an online
 * order — the platform it came from ("GoFood") rather than a bare "Delivery".
 * `platform` is Order.source (or the cart's onlinePlatform); anything that is
 * not a delivery platform is ignored.
 */
export function saleTypeText(t: Translate, orderType: string, platform?: string | null): string {
  if (isOnlinePlatformSource(platform)) return onlinePlatformLabel(t, platform);
  if (orderType === "DINE_IN") return t("pos.checkout.dineIn");
  if (orderType === "TAKEAWAY") return t("pos.checkout.takeaway");
  return t("pos.history.delivery");
}

/** Order.source as a channel name, for order history and the finance channel filter. */
export function orderSourceLabel(t: Translate, source: string): string {
  switch (source) {
    case "MANUAL":
      return t("pos.history.sourceManual");
    case "STOREFRONT":
      return t("pos.history.sourceStorefront");
    case "POS":
      return t("pos.history.sourcePos");
    default:
      return isOnlinePlatformSource(source) ? onlinePlatformLabel(t, source) : source;
  }
}

/**
 * The source badge on the order queue: "Walk-in" for a till sale, the platform's
 * name for a delivery-platform order (so a GoFood driver's order is findable at a
 * glance), and "Online" for the storefront and anything else.
 */
export function orderSourceBadgeLabel(t: Translate, source: string): string {
  if (source === "POS") return t("pos.source.walkIn");
  if (isOnlinePlatformSource(source)) return onlinePlatformLabel(t, source);
  return t("pos.source.online");
}
