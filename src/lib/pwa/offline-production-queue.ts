import { get, set, del, keys } from "idb-keyval";
import type { SyncFailureRecord } from "./sync-failure";

export interface OfflineProductionLog {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  queuedAt: string;
  /** Times the server refused this entry (4xx). Connection failures don't count. */
  attempts: number;
  /** Parked for a person after MAX_REJECTED_ATTEMPTS refusals; never auto-deleted. */
  needsAttention?: boolean;
  lastError?: SyncFailureRecord;
}

const PREFIX = "epidom-offline-production-log:";

function key(id: string) {
  return `${PREFIX}${id}`;
}

export async function enqueueProductionLog(
  storeId: string,
  productId: string,
  quantity: number
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: OfflineProductionLog = {
    id,
    storeId,
    productId,
    quantity,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await set(key(id), entry);
  return id;
}

export async function listProductionQueue(): Promise<OfflineProductionLog[]> {
  const allKeys = await keys<string>();
  const entryKeys = allKeys.filter((k) => k.startsWith(PREFIX));
  const entries = await Promise.all(entryKeys.map((k) => get<OfflineProductionLog>(k)));
  return entries
    .filter((e): e is OfflineProductionLog => !!e)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeFromProductionQueue(id: string): Promise<void> {
  await del(key(id));
}

/** Records one server refusal; parks the entry once it has had `maxAttempts`. */
export async function recordProductionRejection(
  entry: OfflineProductionLog,
  error: SyncFailureRecord,
  maxAttempts: number
): Promise<OfflineProductionLog> {
  const attempts = entry.attempts + 1;
  const next: OfflineProductionLog = {
    ...entry,
    attempts,
    lastError: error,
    needsAttention: attempts >= maxAttempts,
  };
  await set(key(entry.id), next);
  return next;
}

/** Puts this store's parked entries back in line, with a fresh attempt budget. */
export async function requeueParkedProduction(storeId: string): Promise<number> {
  const parked = (await listProductionQueue()).filter(
    (e) => e.storeId === storeId && e.needsAttention
  );
  await Promise.all(
    parked.map((e) => set(key(e.id), { ...e, attempts: 0, needsAttention: false }))
  );
  return parked.length;
}

export async function productionQueueSize(): Promise<number> {
  const allKeys = await keys<string>();
  return allKeys.filter((k) => k.startsWith(PREFIX)).length;
}
