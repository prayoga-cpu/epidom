import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  invalidateMaterialRelatedQueries,
  invalidateProductRelatedQueries,
  invalidateFinanceQueries,
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

/**
 * Regression cover for production feedback "cmtzpmmd": cancelling/refunding
 * an order in POS Order History left the Finance page and dashboard
 * analytics showing pre-cancel numbers for up to their staleTime — the
 * underlying revenue queries were always correct (verified against the live
 * database), the mutations just never told any of them to refetch.
 *
 * The fix is a predicate over each query's key prefix, not a fixed list of
 * keys — the finance/dashboard/owner/storefront surfaces each invented their
 * own naming independently (`finance-*`, `analytics-*`, `owner-summary`,
 * `storefront-analytics*`), which is exactly the kind of thing that's easy
 * to enumerate incompletely by hand (this file's own fix missed
 * `analytics-*`, `owner-summary`, and `storefront-analytics*` on the first
 * pass — caught only by grepping every consumer of every
 * `NON_REVENUE_STATUSES`-filtered API route, not by re-reading the ticket).
 * These cases lock in that every prefix actually in use is covered, and that
 * the predicate doesn't overreach into unrelated same-namespace keys.
 */
describe("invalidateFinanceQueries", () => {
  it.each([
    ["finance-summary", ["finance-summary", STORE_ID, "2026-01-01", "2026-01-31"]],
    ["analytics-orders", ["analytics-orders", STORE_ID, "2026-01-01", "2026-01-01"]],
    ["owner-summary (no storeId in its key)", ["owner-summary", "2026-01-01", "2026-01-31"]],
    ["storefront-analytics-top-ordered", ["storefront-analytics-top-ordered", STORE_ID]],
  ])("refetches a mounted-but-inactive %s query", async (_label, queryKey) => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({}));

    await seedInactiveQuery(queryClient, queryKey, queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);

    invalidateFinanceQueries(queryClient);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it("does not refetch an unrelated query that merely shares an 'owner-' prefix", async () => {
    const queryClient = makeClient();
    const queryFn = vi.fn(async () => ({ pinSet: true }));

    // "owner-pin-status" starts with "owner-" but not the "owner-summary"
    // this fix targets — must not be swept up by a too-broad predicate.
    await seedInactiveQuery(queryClient, ["owner-pin-status"], queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);

    invalidateFinanceQueries(queryClient);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
