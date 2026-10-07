"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { ApiClientError } from "@/lib/api/client";
import { productKeys } from "../../products/hooks/use-products";
import { materialKeys } from "../../materials/hooks/use-materials";
import { recipeKeys } from "../../recipes/hooks/use-recipes";
import {
  DATA_SETUP_DEFAULTS,
  sanitizeDataSetupState,
  type DataSetupCounts,
  type DataSetupState,
} from "../lib/data-setup";

/**
 * The way in the owner picked (saved per store on this device), and whether
 * the saved value has been read yet: until it has, the page can't tell an
 * owner who never picked from one who did, so it shouldn't show either.
 */
export function useDataSetupState(storeId: string) {
  const [state, setState] = usePersistedState<DataSetupState>(
    `epidom-data-setup-${storeId}`,
    DATA_SETUP_DEFAULTS,
    sanitizeDataSetupState
  );
  // Set in the same commit as usePersistedState's read of the saved value
  // (effects run in order), so `ready` never shows the defaults as an answer.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { state, setState, ready } as const;
}

/** One-row read of a list: only its `total` is used. */
async function fetchListPage<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiClientError(error, response.status);
  }
  const body = await response.json();
  return body?.success === true ? body.data : body;
}

/**
 * Live store-wide totals of the menu (STANDARD products), raw materials and
 * recipes, so the setup moves on the moment something is added.
 *
 * Each is a one-row page cached UNDER its list's key prefix, in the list's own
 * shape: every add, delete, import and realtime event that refreshes the
 * lists (they all target the prefix) refreshes these too, and the optimistic
 * updates that bump `total` work on them unchanged. Until a read lands, the
 * server's totals stand in. Off while the page doesn't need them.
 */
export function useDataSetupCounts(
  storeId: string,
  initial: DataSetupCounts,
  enabled: boolean
): DataSetupCounts {
  const options = { enabled: enabled && !!storeId, staleTime: 20 * 1000 } as const;

  const products = useQuery({
    queryKey: productKeys.list(storeId, { productLine: "STANDARD", take: 1 }),
    queryFn: () =>
      fetchListPage<{ total: number }>(
        `/api/stores/${storeId}/products?productLine=STANDARD&take=1`
      ),
    ...options,
  });
  const materials = useQuery({
    queryKey: [...materialKeys.lists(storeId), { take: 1 }],
    queryFn: () => fetchListPage<{ total: number }>(`/api/stores/${storeId}/materials?take=1`),
    ...options,
  });
  const recipes = useQuery({
    queryKey: [...recipeKeys.lists(storeId), { take: 1 }],
    queryFn: () => fetchListPage<{ total: number }>(`/api/stores/${storeId}/recipes?take=1`),
    ...options,
  });

  return {
    products: products.data?.total ?? initial.products,
    materials: materials.data?.total ?? initial.materials,
    recipes: recipes.data?.total ?? initial.recipes,
  };
}
