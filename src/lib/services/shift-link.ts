import { prisma } from "@/lib/prisma";

/**
 * Which shift a sale may attach to.
 *
 * The client names the shift it BELIEVES is open — learned at sign-in and refreshed
 * by a 60s poll. With one till shared by every tablet, that belief can be a minute
 * stale: another tablet may have finished the shift, or opened the next one. The
 * server is the one that knows, so it decides:
 *
 * - the named shift is open in THIS store → that shift;
 * - the named shift is closed, gone, or belongs to another store → the store's
 *   current open shift, else `null`. Unlinked sales show up on the report's "cash
 *   sales not on a till" line, which is honest; attaching to a closed shift would
 *   silently miss its frozen expected cash and push the next drawer Over;
 * - nothing named → `undefined`, so the caller keeps its own default. Offline
 *   replays send no shift on purpose: guessing "the current one" would file a sale
 *   rung hours ago under whatever shift happens to be open when it syncs.
 */
export async function resolveSaleShiftId(
  storeId: string,
  requested: string | null | undefined
): Promise<string | null | undefined> {
  if (!requested) return undefined;

  // One query: the named row (whatever its state) and every open shift, newest first.
  const rows = await prisma.shift.findMany({
    where: { storeId, OR: [{ id: requested }, { closedAt: null }] },
    orderBy: { openedAt: "desc" },
    select: { id: true, closedAt: true },
  });

  const named = rows.find((row) => row.id === requested && row.closedAt === null);
  if (named) return named.id;
  return rows.find((row) => row.closedAt === null)?.id ?? null;
}
