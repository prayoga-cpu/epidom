import { cache } from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { grantedSections, type AdminAccessSummary } from "@/config/admin-sections.config";

/** How the account qualifies for the admin panel (recorded on every audited admin action). */
export type AdminGrantSource = "DB_FLAG" | "HARDCODED_EMAIL" | "SECTION_GRANT";

export interface AdminAccess extends AdminAccessSummary {
  user: { id: string; email: string; name: string };
  /** Null when the account has no admin page at all (it may still be a partner). */
  grantSource: AdminGrantSource | null;
  /** The account's own Partner row id, if it is a partner (the one that earns). */
  partnerId: string | null;
  /**
   * Partner pages this account may open: its own first, then the ones it was
   * added to as a read-only viewer (PartnerViewer).
   */
  viewablePartnerIds: string[];
}

/**
 * What the signed-in account may open in the admin panel, read once per
 * request. A deactivated account gets nothing.
 *
 * The DB flag wins over the hardcoded list when both apply: it is the durable
 * grant, and the hardcoded list is the fallback that leaves no record.
 */
export const getAdminAccess = cache(async function getAdminAccess(): Promise<AdminAccess | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      adminSections: true,
      deactivatedAt: true,
      partner: { select: { id: true } },
      partnerViews: { select: { partnerId: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!user || user.deactivatedAt) return null;

  return resolveAdminAccess(user);
});

/** Pure: the access a user row carries. */
export function resolveAdminAccess(user: {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  adminSections: string[];
  partner: { id: string } | null;
  partnerViews?: { partnerId: string }[];
}): AdminAccess {
  const hardcoded = isAdminEmail(user.email);
  const full = user.isAdmin || hardcoded;
  const sections = full ? [] : grantedSections(user.adminSections);
  const viewablePartnerIds = [
    ...new Set([
      ...(user.partner ? [user.partner.id] : []),
      ...(user.partnerViews ?? []).map((v) => v.partnerId),
    ]),
  ];
  return {
    user: { id: user.id, email: user.email, name: user.name },
    full,
    sections,
    partner: viewablePartnerIds.length > 0,
    partnerId: user.partner?.id ?? null,
    viewablePartnerIds,
    grantSource: user.isAdmin
      ? "DB_FLAG"
      : hardcoded
        ? "HARDCODED_EMAIL"
        : sections.length > 0
          ? "SECTION_GRANT"
          : null,
  };
}
