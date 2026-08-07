import type { StaffRole } from "@prisma/client";
import { getAllDashboardNavItems } from "./navigation.config";

/** Every page a staff member could conceivably be granted — the nav item hrefs. */
export const ALL_STAFF_PAGES: string[] = getAllDashboardNavItems().map((item) => item.href);

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
  ],
  CASHIER: ["/pos", "/pos/orders", "/tables", "/schedule"],
  KITCHEN: ["/pos/kds", "/schedule"],
};

/** Resolves a staff member's effective page access: their own override, or their role's default. */
export function resolveStaffAllowedPages(role: StaffRole, allowedPages: string[]): string[] {
  return allowedPages.length > 0 ? allowedPages : (ROLE_DEFAULT_PAGES[role] ?? []);
}
