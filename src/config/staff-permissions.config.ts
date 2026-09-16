import type { StaffRole } from "@prisma/client";
import { getAllDashboardNavItems } from "./navigation.config";

/**
 * POS Mode routes that deliberately have no Back Office nav entry (so they
 * never leak into that rail — see docs/dashboard-revamp.md) but must still
 * validate as grantable pages, or the first time an owner edits any
 * permission for an existing Cashier/Kitchen staffer, allowedPagesSchema
 * would silently reject it and they'd lose clock-in access.
 */
const POS_MODE_ONLY_PAGES = ["/pos/schedule"];

/** Every page a staff member could conceivably be granted — the nav item hrefs. */
export const ALL_STAFF_PAGES: string[] = [
  ...getAllDashboardNavItems().map((item) => item.href),
  ...POS_MODE_ONLY_PAGES,
];

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
