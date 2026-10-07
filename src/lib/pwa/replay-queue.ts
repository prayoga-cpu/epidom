import { ApiClientError } from "@/lib/api/client";
import { reportNetworkFailure } from "./reachability";
import {
  classifySyncFailure,
  describeSyncFailure,
  type SyncFailureKind,
  type SyncFailureRecord,
} from "./sync-failure";

export interface ReplayableEntry {
  id: string;
  needsAttention?: boolean;
}

export interface ReplayResult {
  synced: number;
  /** Entries that crossed into "needs attention" during this pass. */
  parked: number;
  /** Why the pass ended early, if it did. Remaining entries are untouched. */
  stoppedBy: Exclude<SyncFailureKind, "rejected"> | null;
}

/**
 * The one replay loop every offline write queue (sales, table status,
 * production logs) runs, oldest first.
 *
 * - Success → `remove`.
 * - A connection problem or 5xx → stop the whole pass, touch nothing: the next
 *   entry would hit the same wall, and none of this is the entry's fault.
 * - 401 → stop too; the entries wait for a fresh sign-in.
 * - Any other 4xx → `reject`, which decides whether to count it, park it for a
 *   person, or (for state that is simply stale, like a table already re-seated)
 *   drop it. One refused entry never blocks the ones behind it.
 *
 * Parked entries are skipped; only a person puts them back in line.
 */
export async function replayQueue<E extends ReplayableEntry>(
  entries: E[],
  handlers: {
    send: (entry: E) => Promise<void>;
    remove: (entry: E) => Promise<void>;
    reject: (entry: E, failure: SyncFailureRecord, error: unknown) => Promise<{ parked: boolean }>;
  }
): Promise<ReplayResult> {
  const result: ReplayResult = { synced: 0, parked: 0, stoppedBy: null };

  for (const entry of entries) {
    if (entry.needsAttention) continue;
    try {
      await handlers.send(entry);
    } catch (error) {
      const kind = classifySyncFailure(error);
      if (kind !== "rejected") {
        // A thrown fetch is the app's own evidence the connection just went;
        // let the probe confirm it now rather than on its slow heartbeat.
        if (!(error instanceof ApiClientError)) reportNetworkFailure();
        result.stoppedBy = kind;
        break;
      }
      const { parked } = await handlers.reject(entry, describeSyncFailure(error), error);
      if (parked) result.parked++;
      continue;
    }
    await handlers.remove(entry);
    result.synced++;
  }

  return result;
}

/**
 * Whether a re-read of a queue changed anything worth re-rendering for. The
 * queue hooks re-read IndexedDB after every pass and every mount; handing React
 * a fresh-but-identical array each time re-renders every consumer, and any
 * effect keyed on that state can then loop.
 */
export function sameQueueEntries<E extends ReplayableEntry & { attempts?: number }>(
  a: readonly E[],
  b: readonly E[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (e, i) =>
        e.id === b[i].id &&
        e.attempts === b[i].attempts &&
        !!e.needsAttention === !!b[i].needsAttention
    )
  );
}
