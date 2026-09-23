/**
 * Call-out numbers for the orders list: #1, #2, … per store, restarting each
 * store-local day (Business.timezone).
 *
 * Call this INSIDE the transaction that creates the Order, as late as possible
 * before the `order.create`: the counter row is locked until that transaction
 * ends, so anything after it in the same transaction is time every other till in
 * the store spends waiting. A rolled-back order (e.g. an offline replay that
 * loses the clientRequestId race) rolls its increment back too, so numbers never
 * skip.
 *
 * Only orders created by our own tills and the storefront get one. Aggregator
 * email imports (GoFood/GrabFood/…) don't — the platform's own code is their
 * ticket, and spending our sequence on them would leave holes in the numbers the
 * counter actually calls out. Finalize/merge/re-hold update an existing row and
 * keep the number it was born with.
 */
import type { Prisma } from "@prisma/client";
import { getBusinessDateKey } from "@/lib/attendance/business-date";

type Tx = Prisma.TransactionClient;

export interface AllocateQueueNumberOptions {
  storeId: string;
  /** IANA zone. Omit and it is read from the store's business (one PK lookup). */
  timezone?: string;
  /**
   * The instant that decides which day's sequence this is. Defaults to now —
   * never pass a backdated `orderDate` (an imported order's date is from the past).
   */
  now?: Date;
  /**
   * Bills from one "split by items" checkout share their group's number instead
   * of each taking a new one — it is one party at one counter. Best-effort: bills
   * committed concurrently may not see each other yet and simply take their own.
   */
  splitGroupId?: string | null;
}

/**
 * Store-local "YYYY-MM-DD" for `now`. Business.timezone isn't IANA-validated
 * anywhere upstream, and `Intl.DateTimeFormat` throws a RangeError on a bad one —
 * an order must still be created, so a bad zone buckets by UTC instead.
 */
export function storeLocalDay(now: Date, timezone: string): string {
  try {
    return getBusinessDateKey(now, timezone);
  } catch {
    return getBusinessDateKey(now, "UTC");
  }
}

async function lookupTimezone(tx: Tx, storeId: string): Promise<string> {
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: { business: { select: { timezone: true } } },
  });
  return store?.business.timezone ?? "UTC";
}

export async function allocateQueueNumber(
  tx: Tx,
  { storeId, timezone, now = new Date(), splitGroupId }: AllocateQueueNumberOptions
): Promise<number> {
  if (splitGroupId) {
    const sibling = await tx.order.findFirst({
      where: { storeId, splitGroupId, queueNumber: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { queueNumber: true },
    });
    if (sibling?.queueNumber != null) return sibling.queueNumber;
  }

  const day = storeLocalDay(now, timezone ?? (await lookupTimezone(tx, storeId)));

  // One statement, so the read-increment-write can't interleave with another
  // till's: the first order of the day inserts the row at 1, every later one
  // bumps it, and the conflict target's row lock queues concurrent callers.
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "order_queue_counters" ("storeId", "day", "last")
    VALUES (${storeId}, ${day}, 1)
    ON CONFLICT ("storeId", "day")
    DO UPDATE SET "last" = "order_queue_counters"."last" + 1
    RETURNING "last"`;

  const last = rows[0]?.last;
  if (typeof last !== "number") {
    throw new Error("allocateQueueNumber: counter upsert returned no row");
  }
  return last;
}
