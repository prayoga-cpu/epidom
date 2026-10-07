/**
 * Online payment on the public storefront — QRIS / e-wallets / bank VA through
 * Xendit, card through the merchant's Stripe Connect account.
 *
 * OFF for now (2026-10): every storefront order is "pay at the cashier". It is
 * still ordered online and goes to the kitchen as before, but it is placed
 * UNPAID (paymentStatus PENDING, recorded as CASH until the cashier picks the
 * real method when settling), the till is alerted, and the cashier takes the
 * money at the counter with "Mark as Paid".
 *
 * Nothing was removed: the provider code, the webhooks and the customer's
 * method picker are all still wired. Setting this back to true restores them,
 * with one deliberate difference — a "Pay at Cashier" order now always starts
 * unpaid, where it used to be recorded as PAID before any money changed hands.
 */
export const STOREFRONT_ONLINE_PAYMENTS_ENABLED = false;

/**
 * Marketing copy that promises online payment (the homepage's "Online
 * payments" card, a problem-picker fix, the storefront space, the switcher's
 * result and the pricing FAQ) has a "pay at the counter" twin under the same
 * key + "PayAtCounter". This picks the one that is true right now, so the site
 * never sells what the storefront doesn't offer — and goes back by itself when
 * the switch above is turned on again.
 */
export function onlinePaymentCopyKey(key: string): string {
  return STOREFRONT_ONLINE_PAYMENTS_ENABLED ? key : `${key}PayAtCounter`;
}
