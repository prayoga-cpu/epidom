import { vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The handful of English strings the cart tests assert on. Everything else
 * falls back to its own key, so a test that reads "cashierCart.more.title"
 * still passes if the wording changes — only interpolated strings (where the
 * VALUE is the point) get real text here.
 */
const STRINGS: Record<string, string> = {
  "cashierCart.header.orderQueue": "Order Queue",
  "cashierCart.header.dineIn": "Dine In",
  "cashierCart.header.takeAway": "Take Away",
  "cashierCart.header.paxCount": "{count} pax",
  "cashierCart.header.paxCountOne": "1 pax",
  "cashierCart.header.tableShort": "Table {table}",
  "cashierCart.customer.add": "Add Customer",
  "cashierCart.customer.points": "{count} pts",
  "cashierCart.customer.lifetimeSpend": "Lifetime spend {amount}",
  "cashierCart.bill.serviceCharge": "Service Charge ({rate})",
  "cashierCart.bill.tax": "{name} ({rate})",
  "cashierCart.bill.taxIncluded": "{name} ({rate}) included",
  "cashierCart.bill.taxDefaultName": "Tax",
  "cashierCart.bill.pointsCount": "{count} pts",
  "cashierCart.bill.couponLabel": "Coupon {code}",
  "cashierCart.bill.discount": "Discount",
  "cashierCart.bill.pointsRedeemed": "Points redeemed",
  "cashierCart.bill.subTotal": "Sub-Total",
  "cashierCart.bill.total": "Total",
  "cashierCart.footer.charge": "Charge",
  "cashierCart.couponDialog.applied": "Coupon {code} applied",
  "cashierCart.pointsDialog.balance": "{count} pts",
  "cashierCart.pointsDialog.pointValue": "1 point = {value}",
  "cashierCart.pointsDialog.upTo": "Up to {count} points on this bill",
  "cashierCart.pointsDialog.reason.BELOW_MINIMUM": "Redeem at least {min} points.",
  "cashierCart.mergeDialog.merge": "Merge {count} bills",
  "cashierCart.mergeDialog.itemCount": "{count} items",
  "cashierCart.more.title": "More",
};

/** The `t` the mocked useI18n returns. */
export function translate(key: string): string {
  return STRINGS[key] ?? key;
}

/**
 * Money mock for `useCurrency`: formats as "EUR 12.50" so a test can see BOTH
 * the value and the currency it was formatted in. Every cart amount is literal
 * in the store's display currency, so a call that forgets to pass `currency` as
 * the second argument would format as "IDR …" here and fail loudly — the
 * recurring bug class this repo has.
 */
export function makeCurrencyMock(currency = "EUR") {
  const formatPrice = (value: number | null | undefined, from?: string) =>
    `${from ?? "IDR"} ${Number(value ?? 0).toFixed(2)}`;
  const spy = vi.fn(formatPrice);
  return { currency, formatPrice: spy };
}

export function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

/** Radix Popper/Popover measure with ResizeObserver, which jsdom doesn't have. */
export function stubBrowserApis() {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
}
