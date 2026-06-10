"use server";

/**
 * MVP POS Server Actions
 *
 * Server-side actions for processing POS transactions
 */

import { posService } from "@/lib/services/pos.service";
import type { CartItem, CheckoutResult } from "./types";

interface CheckoutInput {
  storeId: string;
  items: CartItem[];
  total: number;
}

/**
 * Process POS checkout
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  return posService.processCheckout(input);
}

/**
 * Get products for POS
 */
export async function getProductsForPOS(storeId: string) {
  return posService.getProductsForPOS(storeId);
}

/**
 * Get recent transactions count for validation
 */
export async function getTransactionCount(storeId: string): Promise<number> {
  return posService.getTransactionCount(storeId);
}
