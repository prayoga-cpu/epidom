/**
 * Who may hold a till session (`Shift`) — shared by the Shift page, the status
 * bar's shift chip and the overflow menu's link so the three can never disagree
 * about whether a persona has a shift to show.
 *
 * Kitchen never counts cash. Everyone who runs a register does.
 */
export const SHIFT_CAPABLE_ROLES: ReadonlySet<string> = new Set(["CASHIER", "MANAGER", "OWNER"]);

export interface ShiftAccessSession {
  staffRole: string | null;
  /** Null for the synthetic owner persona, which is unrestricted. */
  allowedPages: string[] | null;
}

/**
 * The Shift page is granted by the same "/pos" page grant the till APIs already
 * require (see staff-principal-policy.ts) — whoever can ring up sales can open
 * and close their own till. A separate grant would have silently cut off every
 * staff member whose owner had customised their page list before this page
 * existed.
 */
export function canManageShift(session: ShiftAccessSession): boolean {
  if (!session.staffRole || !SHIFT_CAPABLE_ROLES.has(session.staffRole)) return false;
  // `== null`: no page list at all means unrestricted, whether it is the owner's
  // explicit null or a session that never carried one.
  if (session.staffRole === "OWNER" || session.allowedPages == null) return true;
  return session.allowedPages.includes("/pos");
}
