import { get, set, del, keys } from "idb-keyval";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";
import type { SyncFailureRecord } from "./sync-failure";

export interface OfflineOrder {
  id: string;
  storeId: string;
  order: CreatePosOrderInput;
  queuedAt: string;
  /** Times the server refused this entry (4xx). Connection failures don't count. */
  attempts: number;
  /**
   * Set once the server has refused the entry MAX_REJECTED_ATTEMPTS times. It
   * then stops replaying automatically and waits for a person in the Offline &
   * Sync panel (retry, download, or discard). Absent on entries written before
   * this field existed, which reads as "still pending".
   */
  needsAttention?: boolean;
  lastError?: SyncFailureRecord;
}

const PREFIX = "epidom-offline-order:";

/**
 * Fired on `window` when a sale is queued from outside the queue hook (the
 * checkout dialog), so every count on screen updates at once instead of on the
 * next sync pass.
 */
export const OFFLINE_QUEUE_CHANGED_EVENT = "epidom:offline-queue-changed";

function key(id: string) {
  return `${PREFIX}${id}`;
}

/** The number printed on a queued sale's receipt, before the server assigns a real one. */
export function offlineOrderNumber(id: string): string {
  return `OFFLINE-${id.slice(0, 8).toUpperCase()}`;
}

/**
 * Queues a sale the till couldn't send. `id` is the idempotency key the server
 * dedupes on: pass the one an online attempt already used, so a request that
 * did reach the server before the connection died can't be recorded twice.
 *
 * The sale's own time goes into the payload as `clientCreatedAt`, so on sync it
 * is recorded when it was rung up rather than when the connection came back.
 */
export async function enqueueOrder(
  storeId: string,
  order: CreatePosOrderInput,
  id: string = crypto.randomUUID()
): Promise<string> {
  const queuedAt = new Date().toISOString();
  const entry: OfflineOrder = {
    id,
    storeId,
    order: { ...order, clientCreatedAt: order.clientCreatedAt ?? queuedAt },
    queuedAt,
    attempts: 0,
  };
  await set(key(id), entry);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
  return id;
}

export async function listQueue(): Promise<OfflineOrder[]> {
  const allKeys = await keys<string>();
  const orderKeys = allKeys.filter((k) => k.startsWith(PREFIX));
  const entries = await Promise.all(orderKeys.map((k) => get<OfflineOrder>(k)));
  return entries
    .filter((e): e is OfflineOrder => !!e)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeFromQueue(id: string): Promise<void> {
  await del(key(id));
}

/** Records one server refusal; parks the entry once it has had `maxAttempts`. */
export async function recordRejection(
  entry: OfflineOrder,
  error: SyncFailureRecord,
  maxAttempts: number
): Promise<OfflineOrder> {
  const attempts = entry.attempts + 1;
  const next: OfflineOrder = {
    ...entry,
    attempts,
    lastError: error,
    needsAttention: attempts >= maxAttempts,
  };
  await set(key(entry.id), next);
  return next;
}

/** Puts this store's parked entries back in line, with a fresh attempt budget. */
export async function requeueParked(storeId: string): Promise<number> {
  const parked = (await listQueue()).filter((e) => e.storeId === storeId && e.needsAttention);
  await Promise.all(
    parked.map((e) => set(key(e.id), { ...e, attempts: 0, needsAttention: false }))
  );
  return parked.length;
}

export async function queueSize(): Promise<number> {
  const allKeys = await keys<string>();
  return allKeys.filter((k) => k.startsWith(PREFIX)).length;
}
