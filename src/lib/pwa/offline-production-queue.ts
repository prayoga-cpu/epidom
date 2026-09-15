import { get, set, del, keys } from "idb-keyval";

export interface OfflineProductionLog {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  queuedAt: string;
  attempts: number;
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

export async function incrementProductionQueueAttempts(entry: OfflineProductionLog): Promise<void> {
  await set(key(entry.id), { ...entry, attempts: entry.attempts + 1 });
}

export async function productionQueueSize(): Promise<number> {
  const allKeys = await keys<string>();
  return allKeys.filter((k) => k.startsWith(PREFIX)).length;
}
