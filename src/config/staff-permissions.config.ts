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
