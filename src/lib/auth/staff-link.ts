import type { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickStaffLandingPage, resolveStaffAllowedPages } from "@/config/staff-permissions.config";

/**
 * What "this login account is staff at a store" means, in one place: an ACTIVE
 * StaffMember row that is not the OWNER row. verifyStoreAccess (the wall) and
 * every "which store is this person's" lookup below use it, so "is staff
 * somewhere" and "may enter that store" cannot drift apart.
 */
export function linkedStaffWhere(userId: string) {
  return { userId, isActive: true, role: { not: "OWNER" as const } };
}

/**
 * The staff profile a login account is linked to, with the store it belongs to
 * (only the columns the store list shows). At most one exists — StaffMember.userId
 * is @unique — so this is "the" link, or null.
 */
export async function getLinkedStaffForUser(userId: string) {
  return prisma.staffMember.findFirst({
    where: linkedStaffWhere(userId),
    select: {
      id: true,
      storeId: true,
      role: true,
      allowedPages: true,
      store: {
        select: {
          id: true,
          businessId: true,
          name: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

/**
 * Where to send a linked staff account that asked for `requestedSection` (a
 * POS Mode page such as "/pos/orders"): that page if their grants cover it,
 * otherwise their first reachable POS page. Null when they have none (a
 * back-office-only role) — the caller falls back to the store list, which
 * never redirects back and so can't loop.
 */
export function linkedStaffLandingPath(
  link: { storeId: string; role: StaffRole; allowedPages: string[] },
  requestedSection?: string | null
): string | null {
  const page = pickStaffLandingPage(
    resolveStaffAllowedPages(link.role, link.allowedPages),
    requestedSection
  );
  return page ? `/store/${link.storeId}${page}` : null;
}
