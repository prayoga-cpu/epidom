import type { StaffRole } from "@prisma/client";
import { getAllAppNavItems } from "./navigation.config";

/** Every page a staff member could conceivably be granted — every app nav
 * item's href, dashboardNavigation AND POS Mode's own routes together (see
 * getAllAppNavItems' own doc comment for why dashboardNavigation alone isn't
 * enough here). Missing either half silently breaks something an owner
 * can't easily notice: without the POS Mode half, allowedPagesSchema
 * rejects a hand-edited Cashier/Kitchen permission set (confirmed by
 * staff-permissions.config.test.ts). */
export const ALL_STAFF_PAGES: string[] = getAllAppNavItems().map((item) => item.href);

/**
 * Default page access per role — the starting point shown (and editable) in
 * the Staff dialog's checklist. Owner-only surfaces (Profile, Billing,
 * Staff) are enforced separately by requireOwnerOnly and never granted here.
 */
export const ROLE_DEFAULT_PAGES: Record<StaffRole, string[]> = {
  OWNER: ALL_STAFF_PAGES,
  MANAGER: [
    "/dashboard",
    "/storefront",
    "/pos",
    "/pos/orders",
    "/pos/kds",
    "/tables",
    "/menu",
    "/management",
    "/production",
    "/data",
    "/alerts",
    "/schedule",
    // Manager reaches the full roster builder at /schedule, but the POS
    // Mode overflow menu's "My Shift" link is the same for every role —
    // without this, a Manager PIN persona tapping it from POS Mode would
    // dead-end at requireStaffPageAccess instead of clocking in.
    "/pos/schedule",
  ],
  CASHIER: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
  KITCHEN: ["/pos/kds", "/pos/schedule"],
};

/** Resolves a staff member's effective page access: their own override, or their role's default. */
export function resolveStaffAllowedPages(role: StaffRole, allowedPages: string[]): string[] {
  return allowedPages.length > 0 ? allowedPages : (ROLE_DEFAULT_PAGES[role] ?? []);
}

/**
 * One merged Role + Job-title picker for the Staff dialog — Manager and
 * Kitchen alongside named job titles on both sides of the POS<->Back
 * Office split: front-of-house (Waiter, Bartender, Host — StaffRole.CASHIER
 * underneath) and back-office-only (Admin, Finance — StaffRole.MANAGER
 * underneath), each with real differences in which pages actually make
 * sense day to day. The job titles are deliberately NOT new StaffRole enum
 * values: that would mean a Prisma migration plus auditing every
 * `staffRole === "..."` branch already written across the app this session
 * (nav gating, the POS<->Back Office switcher, requireStaffPageAccess's
 * OWNER bypass, ...). Instead this is a template layer on top of the
 * existing 4 roles — picking one sets `role`, a translated
 * `customRoleLabel` (see staffRoleLabel) for the ones that need a distinct
 * display name, and a tailored `allowedPages`, all of which stay fully
 * editable afterward exactly like any other staff member's ("Customize
 * access" in PageAccessChecklist, or the dialog's own "Use custom label"
 * checkbox for the display name specifically).
 *
 * "manager"/"cashier"/"kitchen" map 1:1 onto their plain role — no
 * customRoleLabel needed, staffRoleLabel's own fallback already renders the
 * role's name. Every other id needs customRoleLabel set to actually display
 * as anything other than its underlying role's name — see
 * staff-client.tsx's selection handler.
 */
export interface StaffRoleTemplate {
  id: string;
  role: StaffRole;
  labelKey: string;
  allowedPages: string[];
}

export const STAFF_ROLE_TEMPLATES: StaffRoleTemplate[] = [
  { id: "manager", role: "MANAGER", labelKey: "pages.staffRoleManager", allowedPages: ROLE_DEFAULT_PAGES.MANAGER },
  {
    id: "admin",
    role: "MANAGER",
    labelKey: "pages.staffJobAdmin",
    // Full back-office access, same as Manager, minus the POS/till pages —
    // an office-only role that never needs to cover a shift on the floor.
    // /pos/schedule stays: every persona still clocks in/out through it.
    allowedPages: [
      "/dashboard",
      "/storefront",
      "/menu",
      "/management",
      "/production",
      "/data",
      "/alerts",
      "/schedule",
      "/pos/schedule",
    ],
  },
  {
    id: "finance",
    role: "MANAGER",
    labelKey: "pages.staffJobFinance",
    // Narrow, reporting-only — a bookkeeper/accountant role. No Management
    // (stock), Production, Staff, or POS access at all. /finance itself is
    // ENTERPRISE-plan-gated already (navigation.config.ts) — granting it on
    // a lower-tier store is harmless, the plan gate still applies on top.
    allowedPages: ["/dashboard", "/finance", "/data", "/pos/schedule"],
  },
  { id: "cashier", role: "CASHIER", labelKey: "pages.staffRoleCashier", allowedPages: ROLE_DEFAULT_PAGES.CASHIER },
  {
    id: "waiter",
    role: "CASHIER",
    labelKey: "pages.staffJobWaiter",
    // Takes orders and works tables, same as Cashier — kept as its own
    // template (not just a label) so a future divergence in access doesn't
    // require restructuring this, and so it's visible as a distinct,
    // intentional choice in the checklist's POS group.
    allowedPages: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
  },
  {
    id: "bartender",
    role: "CASHIER",
    labelKey: "pages.staffJobBartender",
    // Plus Kitchen & Bar (/pos/kds) — that screen is where bar-tagged
    // orders actually surface for prep, not just the kitchen's.
    allowedPages: ["/pos", "/pos/orders", "/tables", "/pos/kds", "/pos/schedule"],
  },
  {
    id: "host",
    role: "CASHIER",
    labelKey: "pages.staffJobHost",
    // Seats and manages the floor, not the register — no /pos, no /pos/orders.
    allowedPages: ["/tables", "/pos/schedule"],
  },
  { id: "kitchen", role: "KITCHEN", labelKey: "pages.staffRoleKitchen", allowedPages: ROLE_DEFAULT_PAGES.KITCHEN },
];

/** The role/job-title templates whose display name IS the plain role name —
 * selecting one of these clears customRoleLabel rather than setting a
 * redundant custom label over the role's own default display text. */
const BASE_ROLE_TEMPLATE_IDS = new Set(["manager", "cashier", "kitchen"]);
export function isBaseRoleTemplate(templateId: string): boolean {
  return BASE_ROLE_TEMPLATE_IDS.has(templateId);
}
