"use client";

import { useParams } from "next/navigation";
import { useStore } from "@/features/stores/stores/hooks/use-stores";

/**
 * Custom hook to get the current store from URL params
 *
 * Parses storeId from dynamic route segment (/store/[storeId]/...) and fetches store data.
 * Used across dashboard pages to maintain store context.
 *
 * @returns Current store object, loading state, and error state
 *
 * @example
 * const { store, isLoading, error } = useCurrentStore();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error />;
 * if (!store) return <SelectStore />;
 *
 * return <Dashboard store={store} />;
 */
export function useCurrentStore() {
  const params = useParams();
  const storeId = params.storeId as string;

  const { data: store, isLoading, error } = useStore(storeId || "");

  return {
    store,
    storeId,
    isLoading,
    error,
    hasStore: !!store,
  };
}
