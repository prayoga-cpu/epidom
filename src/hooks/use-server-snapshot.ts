import { useRef } from "react";
import { hashKey, type QueryKey } from "@tanstack/react-query";

/**
 * `initialData` for a list query whose first page a Server Component already
 * fetched.
 *
 * That snapshot describes exactly ONE set of filters: the ones the page
 * rendered with, which is the first key this hook sees (filters restored from
 * storage are applied in an effect, after that first render). React Query
 * applies `initialData` to every query it creates, so passing the snapshot
 * unconditionally seeded each NEW key too — the next page, a category, a sort
 * — with the same first-page rows, and because seeded data counts as fresh it
 * stayed on screen for a whole staleTime. Pressing Next changed the page number
 * and nothing else until the 30s poll caught up.
 */
export function useServerSnapshot<T>(queryKey: QueryKey, snapshot: T | undefined): T | undefined {
  const currentKey = hashKey(queryKey);
  const snapshotKey = useRef(currentKey);
  return currentKey === snapshotKey.current ? snapshot : undefined;
}
