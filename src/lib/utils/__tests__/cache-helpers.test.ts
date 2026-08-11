import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
} from "@/lib/utils/cache-helpers";

/**
 * Regression cover for production feedback "Ticket id #01": a merchant ran a
 * recipe in /production, the material stock was correctly deducted in the DB,
 * and /management kept rendering the pre-production number for ~30s.
 *
 * Two independent causes, both exercised here through OBSERVABLE refetch
 * behaviour rather than by asserting the arguments we happen to pass to
 * invalidateQueries — the whole bug was that plausible-looking arguments
 * produced no refetch.
 */

const STORE_ID = "store-1";
const MATERIALS_KEY = ["materials", STORE_ID, "list", undefined];
const PRODUCTS_KEY = ["products", STORE_ID, "list", undefined];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Mount an observer, wait for its first fetch to land, then unmount it so the query goes inactive. */
async function seedInactiveQuery(
  queryClient: QueryClient,
  queryKey: unknown[],
  queryFn: () => Promise<unknown>,
  options: Record<string, unknown> = {}
) {
  const observer = new QueryObserver(queryClient, {
    queryKey,
    queryFn,
    staleTime: 20 * 1000,
    ...options,
  } as never);
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toBeDefined());
  unsubscribe();
}

describe("refetchOnMount and invalidated queries", () => {
  it("refetches an invalidated query when a new observer mounts (refetchOnMount: true)", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ materials: [], total: 0 }));

    await seedInactiveQuery(queryClient, MATERIALS_KEY, queryFn, { refetchOnMount: true });
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Mark stale without refetching — exactly what an invalidation from a page
    // that has no materials query mounted leaves behind.
    await queryClient.invalidateQueries({
      queryKey: ["materials", STORE_ID],
      exact: false,
      refetchType: "none",
    });

    // Navigating to /management mounts the query again.
    const observer = new QueryObserver(queryClient, {
      queryKey: MATERIALS_KEY,
      queryFn,
      staleTime: 20 * 1000,
      refetchOnMount: true,
    } as never);
    const unsubscribe = observer.subscribe(() => {});

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unsubscribe();
  });

  it("does NOT refetch an invalidated query when refetchOnMount is false — the original bug", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ materials: [], total: 0 }));

    await seedInactiveQuery(queryClient, MATERIALS_KEY, queryFn, { refetchOnMount: false });
    expect(queryFn).toHaveBeenCalledTimes(1);

    await queryClient.invalidateQueries({
      queryKey: ["materials", STORE_ID],
      exact: false,
      refetchType: "none",
    });

    const observer = new QueryObserver(queryClient, {
      queryKey: MATERIALS_KEY,
      queryFn,
      staleTime: 20 * 1000,
      refetchOnMount: false,
    } as never);
    const unsubscribe = observer.subscribe(() => {});

    // Stale, invalidated, freshly mounted — and still no refetch. This is what
    // left /management showing 100g after production had already taken it to 50g.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("invalidateMaterialRelatedQueries", () => {
  it("refetches a materials list that is cached but has no mounted observer", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ materials: [], total: 0 }));

    await seedInactiveQuery(queryClient, MATERIALS_KEY, queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);

    // The mutation happens on /production, which mounts no materials query at
    // all: with the default refetchType "active" this found nothing to refetch.
    await invalidateMaterialRelatedQueries(queryClient, STORE_ID, false);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it("skips the materials list when skipMaterials is set", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ materials: [], total: 0 }));

    await seedInactiveQuery(queryClient, MATERIALS_KEY, queryFn);

    await invalidateMaterialRelatedQueries(queryClient, STORE_ID, false, true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe("invalidateProductRelatedQueries", () => {
  it("refetches a products list that is cached but has no mounted observer", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ products: [], total: 0 }));

    await seedInactiveQuery(queryClient, PRODUCTS_KEY, queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Completing a production batch adds finished-goods stock from /production.
    await invalidateProductRelatedQueries(queryClient, STORE_ID, false);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});
