import { canManageShift } from "@/features/pos/lib/shift-access";

/** The Operational page's tabs, in the order they are shown. */
export const OPERATIONAL_TABS = ["shift", "schedule", "roster", "clock"] as const;
export type OperationalTab = (typeof OPERATIONAL_TABS)[number];

export function isOperationalTab(value: string | null | undefined): value is OperationalTab {
  return (OPERATIONAL_TABS as readonly string[]).includes(value ?? "");
}

export interface OperationalAccess {
  /** Who is signed in: the store's owner account, or a staff member's own linked account. */
  viewer: "owner" | "staff";
  /** The StaffSession (PIN persona) for THIS store, or null — the owner's own persona has none. */
  session: { role: string; allowedPages: string[] } | null;
  /** Whether the store has an active staff member other than the owner to clock in. */
  hasClockableStaff: boolean;
  /**
   * Whether the store's plan covers staff operations (rosters) — the same gate
   * as Back Office /schedule, where the schedule is built and published.
   */
  staffOperations: boolean;
}

/**
 * Which tabs of the Operational page this persona gets. Each tab keeps the
 * grant its old page had — no new permission to hand out, so no staff member
 * whose owner customised their pages loses or gains anything:
 *  - Shift: whoever can ring up sales holds a till (canManageShift, the "/pos"
 *    grant plus a till-holding role) — what /pos/shift required.
 *  - My Schedule: a staff persona with the "/pos/schedule" grant. It shows that
 *    staff member's own roster, so the owner, who has no staff session, gets no
 *    tab (the old page sent the owner to the Back Office roster instead).
 *  - Team Schedule: the whole team's PUBLISHED roster and schedule images, read
 *    only — for whoever already sees that roster in Back Office /schedule: the
 *    owner, or a Manager persona on the owner's device holding "/schedule". Not
 *    cashiers or kitchen (the roster API narrows them to their own rows), and
 *    never a linked account (the API refuses it anyone's rows but its own).
 *    Only on plans with rosters at all.
 *  - Clock In / Out: every persona on the owner's device, as the drawer's old
 *    row was — the owner's view is the kiosk (pick a staff member, enter their
 *    PIN) and needs someone to clock. A linked staff account also needs
 *    "/pos/schedule", because the attendance APIs refuse it without.
 */
export function resolveOperationalTabs(access: OperationalAccess): OperationalTab[] {
  const { viewer, session } = access;
  const owner = viewer === "owner" && (!session || session.role === "OWNER");
  const allowedPages = owner ? null : (session?.allowedPages ?? []);
  const hasScheduleGrant = allowedPages === null || allowedPages.includes("/pos/schedule");
  // A linked account never takes the OWNER-role shortcut, whatever its role says
  // (same rule as requireStaffPageAccess) — so its till comes from "/pos" alone.
  const holdsTill =
    owner ||
    (!!session &&
      session.role !== "OWNER" &&
      canManageShift({ staffRole: session.role, allowedPages: session.allowedPages }));

  const seesTeamRoster =
    viewer === "owner" &&
    (owner || (session?.role === "MANAGER" && session.allowedPages.includes("/schedule")));

  const tabs: OperationalTab[] = [];
  if (holdsTill) tabs.push("shift");
  if (session && hasScheduleGrant) tabs.push("schedule");
  if (access.staffOperations && seesTeamRoster) tabs.push("roster");
  if (access.hasClockableStaff && (viewer === "owner" || hasScheduleGrant)) tabs.push("clock");
  return tabs;
}
