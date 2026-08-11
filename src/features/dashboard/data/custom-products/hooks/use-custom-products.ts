"use client";

import { useProducts } from "../../products/hooks/use-products";

/**
 * CUSTOM-productLine products only — the store's optional second product
 * line (e.g. a restaurant's hair-salon add-on). See Product.productLine.
 */
export function useCustomProducts(storeId: string) {
  return useProducts(storeId, {
    productLine: "CUSTOM",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
}
