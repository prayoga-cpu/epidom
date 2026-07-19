/**
 * Real-time Configuration
 *
 * Smart polling: Hanya poll jika tab aktif dan online.
 *
 * Polling intervals di-configure langsung di individual hooks
 * berdasarkan kebutuhan masing-masing data type:
 * - Critical data (alerts): 15s
 * - Active data (materials, recipes, products): 30s
 * - Normal data (supplier orders): 60s
 * - Static data (suppliers): No polling
 */

/**
 * Smart polling condition
 * Hanya poll jika:
 * - Tab aktif (document.visibilityState === 'visible')
 * - Window focused
 * - Network online
 */
export function shouldPoll(): boolean {
  if (typeof window === "undefined") return false;

  return document.visibilityState === "visible" && !document.hidden && navigator.onLine;
}
