import { prisma } from "@/lib/prisma";
import { resolveStaffAllowedPages, pickStaffHomePage } from "@/config/staff-permissions.config";

/**
 * Full path a redirect should use for a linked staff account at this store:
 * their first reachable POS Mode page, else the store list. Always terminates
 * — the store list is not guarded by any of the store guards, so redirecting
 * there can never bounce back.
 */
export async function linkedStaffHomePath(
  storeId: string,
  staffMemberId: string
): Promise<string> {
  const member = await prisma.staffMember.findFirst({
    where: { id: staffMemberId, storeId, isActive: true },
    select: { role: true, allowedPages: true },
  });
  if (!member) return "/stores";

  const page = pickStaffHomePage(resolveStaffAllowedPages(member.role, member.allowedPages));
  return page ? `/store/${storeId}${page}` : "/stores";
}
