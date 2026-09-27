/**
 * "Current shift" — the date scope the Order Queue page (Active and History)
 * opens on while the store's till is open: every order placed since the till
 * was opened, with no end, because the shift is still running. With no till
 * open it reads as Today, which is what the page opened on before a shift
 * drove it.
 *
 * Stored as a preset like the others, never as a shift id or its times, so it
 * follows the till: whichever shift is open now (on any tablet) is the one it
 * shows, and closing the till drops the page back to today by itself.
 *
 * Time-window semantics, NOT `Order.shiftId` linkage: storefront and
 * aggregator orders taken while the till is open carry no shiftId and still
 * belong here. See lib/finance/shift-window.ts.
 */
export const CURRENT_SHIFT_PRESET = "shift";
export type CurrentShiftPreset = typeof CURRENT_SHIFT_PRESET;

/** What the page opens on — and what its reset button goes back to — right now. */
export function defaultScopePreset(hasOpenShift: boolean): CurrentShiftPreset | "today" {
  return hasOpenShift ? CURRENT_SHIFT_PRESET : "today";
}

/**
 * The preset actually in force. "Current shift" with no till open is today, so
 * the date control shows Today rather than naming a shift that isn't running.
 */
export function effectiveScopePreset<P extends string>(
  preset: P,
  hasOpenShift: boolean
): P | "today" {
  return preset === CURRENT_SHIFT_PRESET && !hasOpenShift ? "today" : preset;
}

/**
 * Whether an ISO timestamp falls inside the open shift. Only a lower bound: the
 * till is still running, so an order placed a second ago — or stamped a moment
 * ahead of this device's clock — is in it.
 */
export function isWithinOpenShift(iso: string, openedAt: string): boolean {
  return new Date(iso).getTime() >= new Date(openedAt).getTime();
}
