import { get, set, del, keys } from "idb-keyval";

export interface OfflineTableStatusChange {
  id: string;
  storeId: string;
  tableId: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  /** The status shown on screen when this was queued — see expectedStatus in the API route. */
  expectedStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  queuedAt: string;
  attempts: number;
}

const PREFIX = "epidom-offline-table-status:";

function key(id: string) {
  return `${PREFIX}${id}`;
}

export async function enqueueTableStatusChange(
  storeId: string,
  tableId: string,
  status: OfflineTableStatusChange["status"],
  expectedStatus: OfflineTableStatusChange["expectedStatus"]
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: OfflineTableStatusChange = {
    id,
    storeId,
    tableId,
    status,
    expectedStatus,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await set(key(id), entry);
  return id;
}

export async function listTableQueue(): Promise<OfflineTableStatusChange[]> {
  const allKeys = await keys<string>();
  const entryKeys = allKeys.filter((k) => k.startsWith(PREFIX));
  const entries = await Promise.all(entryKeys.map((k) => get<OfflineTableStatusChange>(k)));
  return entries
    .filter((e): e is OfflineTableStatusChange => !!e)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeFromTableQueue(id: string): Promise<void> {
  await del(key(id));
}

export async function incrementTableQueueAttempts(entry: OfflineTableStatusChange): Promise<void> {
  await set(key(entry.id), { ...entry, attempts: entry.attempts + 1 });
}

export async function tableQueueSize(): Promise<number> {
  const allKeys = await keys<string>();
  return allKeys.filter((k) => k.startsWith(PREFIX)).length;
}
