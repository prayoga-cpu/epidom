import { prisma } from "@/lib/prisma";
import { CLOCK_SKEW_TOLERANCE_MS } from "./offline-replay";

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
 * - nothing named → `undefined`, so the caller keeps its own default.
 *
 * Offline replays don't come through here: guessing "the current one" would file
 * a sale rung hours ago under whatever shift happens to be open when it syncs.
 * They use resolveReplayShiftId below.
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

/**
 * Which shift a sale replayed from the offline queue may attach to.
 *
 * Only the shift the till named when it rang the sale up, and only while that
 * shift is STILL open and had already opened by then (`occurredAt`). That is the
 * drawer the cash physically went into, and its expected cash is still live, so
 * linking keeps the count honest — before this, every offline sale came back
 * unlinked and a two-minute wifi drop mid-shift left the drawer Over at close.
 *
 * Anything else → `null`, never another shift: a closed shift's expected cash is
 * frozen (adding a sale now would contradict its count), and the shift open at
 * sync time is a different drawer. Unlinked sales land on the report's "cash
 * sales not on a till" line for a person to reconcile.
 */
export async function resolveReplayShiftId(
  storeId: string,
  requested: string | null | undefined,
  /** Null when the till's clock couldn't be trusted — then nothing is linked. */
  occurredAt: Date | null
): Promise<string | null | undefined> {
  if (!requested) return undefined;
  if (!occurredAt) return null;

  const shift = await prisma.shift.findFirst({
    where: { id: requested, storeId },
    select: { id: true, openedAt: true, closedAt: true },
  });
  if (!shift || shift.closedAt !== null) return null;
  // The till's clock and ours disagree by a little; a sale rung right after
  // opening may read a moment before it.
  const openedBy = occurredAt.getTime() + CLOCK_SKEW_TOLERANCE_MS;
  return shift.openedAt.getTime() <= openedBy ? shift.id : null;
}
