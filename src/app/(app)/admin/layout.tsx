import type { ReactNode } from "react";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { visibleSections } from "@/config/admin-sections.config";
import { AdminNav } from "@/features/admin/components/admin-nav";

/**
 * The admin panel's frame: the row of pages this account may open. Not an
 * auth boundary (a soft navigation between admin pages doesn't re-render a
 * layout): every page calls requireAdminSection itself.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminAccess();
  const sections = access ? visibleSections(access) : [];
  // A partner with no admin page (a sales-page owner, a referrer) has only
  // their own page, which has its own header: no menu to show.
  const showNav = sections.some((s) => s.key !== "my-referrals");

  return (
    <>
      {showNav && (
        <AdminNav
          sections={sections.map(({ key, href, label, icon }) => ({ key, href, label, icon }))}
        />
      )}
      {children}
    </>
  );
}
