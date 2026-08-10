import { get, set } from "idb-keyval";

const PREFIX = "epidom-last-synced:";

function key(storeId: string) {
  return `${PREFIX}${storeId}`;
}

/** Last time this device successfully synced (either direction) with the server, per store. */
export async function getLastSyncedAt(storeId: string): Promise<Date | null> {
  const iso = await get<string>(key(storeId));
  return iso ? new Date(iso) : null;
}

export async function setLastSyncedAt(storeId: string, date: Date = new Date()): Promise<void> {
  await set(key(storeId), date.toISOString());
}
