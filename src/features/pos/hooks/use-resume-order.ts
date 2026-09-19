import { useCallback } from "react";
import { ApiClientError } from "@/lib/api/client";
import { usePosCart } from "./use-pos-cart";
import { fetchCustomerDetail, toCartCustomer } from "./use-customers";
import {
  buildResumeExtras,
  fallbackCustomerFromOrder,
  orderItemsToCartItems,
  type ResumableOrder,
} from "../lib/order-to-cart";
import type { CartCustomer } from "../types/pos.types";

/**
 * Load a saved (HELD) bill into the cart: its lines, order type, pax, table,
 * customer and held discount.
 *
 * The customer is re-read from GET /customers/[id] rather than trusted from the
 * order row, so the points balance shown next to it is current. If that read
 * fails (offline, server hiccup) the resume still goes ahead with a stand-in
 * built from the order — the cart's customer row refreshes it as soon as it
 * can. A 404 means the customer was deleted since the bill was saved, so the
 * bill resumes without one instead of carrying a dangling id that checkout
 * would reject.
 *
 * Shared by the queue's Resume action and by Merge Bill (which resumes the
 * merged order), so both restore exactly the same state.
 */
export async function resumeOrderIntoCart(storeId: string, order: ResumableOrder): Promise<void> {
  let customer: CartCustomer | null = fallbackCustomerFromOrder(order);

  if (order.customerId) {
    try {
      customer = toCartCustomer(await fetchCustomerDetail(storeId, order.customerId));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) customer = null;
    }
  }

  usePosCart
    .getState()
    .hydrateFromOrder(
      orderItemsToCartItems(order.items),
      order.id,
      buildResumeExtras(order, customer)
    );
}

export function useResumeOrderIntoCart(storeId: string) {
  return useCallback((order: ResumableOrder) => resumeOrderIntoCart(storeId, order), [storeId]);
}
