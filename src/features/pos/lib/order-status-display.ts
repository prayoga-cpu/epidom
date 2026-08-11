/**
 * Solid status fill for the queue's order badges, keyed to the same color
 * family as the toolbar's status tiles (STATUS_META) and the card's left
 * border accent — so a status reads the same wherever it shows up. Filled
 * rather than outlined on purpose: the badge is what the eye lands on first
 * on a dense queue, and the previous variant map rendered CONFIRMED and
 * IN_PRODUCTION as visually interchangeable chips.
 *
 * DELIVERED is the one deliberate non-hue: white fill with black text, since
 * "done" shouldn't compete for attention with the statuses that still need a
 * cashier to act. Every fill and text color here is literal, not a theme
 * token, because a status has to read the same in light and dark — a
 * token pair (`bg-foreground text-background`) would invert between themes
 * and turn one badge into two different signals.
 *
 * The text colors carry Tailwind's important modifier (`text-black!`, the v4
 * trailing-`!` syntax — the v3 `!text-black` prefix does not compile here).
 * `Badge`'s cva always emits a text color of its own, and unlike the plain
 * classes it isn't reliably dropped when these are merged in — most visibly
 * in dark mode, where the variant's near-white `text-foreground` left the
 * DELIVERED badge unreadable on its white fill. The fill is fixed regardless
 * of theme, so the text on it has to be too.
 */
export function getOrderStatusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-transparent bg-blue-500 text-white!";
    case "IN_PRODUCTION":
      return "border-transparent bg-orange-500 text-white!";
    case "READY":
      return "border-transparent bg-emerald-500 text-white!";
    case "HELD":
      return "border-transparent bg-slate-500 text-white!";
    case "DELIVERED":
      return "border-transparent bg-white text-black!";
    case "CANCELLED":
      return "border-transparent bg-destructive text-white!";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function getOrderSourceBadgeVariant(source: string): "default" | "secondary" | "outline" {
  switch (source) {
    case "POS":
      return "default";
    case "STOREFRONT":
      return "secondary";
    default:
      return "outline";
  }
}

export function mapOrderStatusLabel(t: (key: string) => string, status: string): string {
  const key = status === "IN_PRODUCTION" ? "inProduction" : status.toLowerCase();
  return t(`pos.status.${key}`);
}

// Mostly reuses the storefront checkout's payment-method map
// (publicOrder.paymentMethods) rather than duplicating a second copy — CASH,
// QRIS, GOPAY, OVO, DANA, SHOPEEPAY, and PAY_LATER already read identically
// in both places. BANK_TRANSFER/STRIPE_CARD are the exception: the POS
// checkout dialog and Mark Paid dialog already established "Virtual
// Account"/"Credit Card" on this side (pos.markPaid.*), distinct from the
// storefront's more generic "Bank Transfer"/"Credit/Debit Card" — kept as
// overrides here so the queue/history views agree with the rest of the POS
// rather than silently drifting to the storefront's wording.
export function mapPaymentMethodLabel(t: (key: string) => string, method: string): string {
  if (method === "BANK_TRANSFER") return t("pos.markPaid.virtualAccount");
  if (method === "STRIPE_CARD") return t("pos.markPaid.creditCard");
  return t(`publicOrder.paymentMethods.${method}`);
}

// Payment methods offered at checkout/Mark Paid, clustered by the market
// they're actually popular in — CASH/STRIPE_CARD lead every list since
// they're universal, "OTHER" (free-text custom label, see Order.paymentNote)
// is handled separately by each dialog rather than listed here.
export type PaymentMethodGroupKey = "common" | "indonesia" | "france" | "worldwide";

export const PAYMENT_METHOD_GROUPS: { key: PaymentMethodGroupKey; methods: string[] }[] = [
  { key: "common", methods: ["CASH", "STRIPE_CARD"] },
  {
    key: "indonesia",
    methods: ["QRIS", "GOPAY", "OVO", "DANA", "SHOPEEPAY", "LINKAJA", "BANK_TRANSFER"],
  },
  { key: "france", methods: ["CHEQUE", "TITRE_RESTAURANT"] },
  { key: "worldwide", methods: ["PAYPAL", "APPLE_PAY", "GOOGLE_PAY"] },
];

// "common" always leads; the market group matching the dashboard's own
// language surfaces next so the cashier's most likely options need the
// least scrolling — every other market stays available right below it,
// since a store can always serve a customer from a different market.
export function orderPaymentMethodGroups(locale: string) {
  const [common, ...markets] = PAYMENT_METHOD_GROUPS;
  const leadKey: PaymentMethodGroupKey =
    locale === "fr" ? "france" : locale === "id" ? "indonesia" : "worldwide";
  const reordered = [...markets].sort((a) => (a.key === leadKey ? -1 : 0));
  return [common, ...reordered];
}

/**
 * An order that hasn't been settled yet — the case the "Unpaid" badge,
 * payment alerts, and the active-queue payment follow-up (delivered orders
 * stay on the Active tab while this is true) all key off. Not limited to Pay
 * Later — any payment method can end up stuck at PENDING (e.g. an online
 * payment that never confirmed).
 */
export function isAwaitingPayment(order: { paymentStatus: string }): boolean {
  return order.paymentStatus === "PENDING";
}

// Low-opacity left-border accent so a busy queue can be scanned by status at
// a glance — same color family as the status filter tiles in the toolbar.
export function getOrderStatusAccentClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-l-2 border-l-blue-500 bg-blue-500/[0.04]";
    case "IN_PRODUCTION":
      return "border-l-2 border-l-orange-500 bg-orange-500/[0.04]";
    case "READY":
      return "border-l-2 border-l-emerald-500 bg-emerald-500/[0.04]";
    case "HELD":
      return "border-l-2 border-l-slate-500 bg-slate-500/[0.04]";
    case "DELIVERED":
      // Only delivered-but-unpaid orders reach the queue at all, so this
      // reads as an urgent "needs payment follow-up" accent, not a generic
      // "done" one.
      return "border-l-2 border-l-destructive bg-destructive/[0.04]";
    default:
      return "";
  }
}
