import { get, set, del, keys } from "idb-keyval";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";

export interface OfflineOrder {
  id: string;
  storeId: string;
  order: CreatePosOrderInput;
  queuedAt: string;
  attempts: number;
}

const PREFIX = "epidom-offline-order:";

function key(id: string) {
  return `${PREFIX}${id}`;
}

export async function enqueueOrder(storeId: string, order: CreatePosOrderInput): Promise<string> {
  const id = crypto.randomUUID();
  const entry: OfflineOrder = {
    id,
    storeId,
    order,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await set(key(id), entry);
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

export async function incrementAttempts(entry: OfflineOrder): Promise<void> {
  await set(key(entry.id), { ...entry, attempts: entry.attempts + 1 });
}

export async function queueSize(): Promise<number> {
  const allKeys = await keys<string>();
  return allKeys.filter((k) => k.startsWith(PREFIX)).length;
}
