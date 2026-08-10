import { get, set } from "idb-keyval";

const PREFIX = "epidom-offline-mode:";

function key(storeId: string) {
  return `${PREFIX}${storeId}`;
}

/**
 * Raw persisted state: `null` means nobody has ever decided for this store —
 * distinct from `false`, which means a user (or the auto-detector) explicitly
 * turned it off. The standalone-install auto-detector relies on this
 * distinction so it only ever offers to enable Offline Mode once; without it,
 * a user who explicitly disables it would have it silently re-enabled the
 * next time they reopen the installed app.
 */
export async function getOfflineModeState(storeId: string): Promise<boolean | null> {
  const value = await get<boolean>(key(storeId));
  return value === undefined ? null : value;
}

/** Whether the user (or the standalone-install auto-detector) has opted this store into Offline Mode. */
export async function isOfflineModeEnabled(storeId: string): Promise<boolean> {
  return (await getOfflineModeState(storeId)) ?? false;
}

export async function setOfflineModeEnabled(storeId: string, enabled: boolean): Promise<void> {
  await set(key(storeId), enabled);
}
