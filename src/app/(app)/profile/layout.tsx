import type { Metadata } from "next";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { ProfileNav } from "@/features/dashboard/profile/components/profile-nav";

export const metadata: Metadata = {
  title: "Profile - EPIDOM",
  description: "Manage your profile and payment settings",
};

/**
 * Profile Page Layout
 *
 * Wraps profile page with I18nProvider for translations
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <SiteHeader variant="authenticated" showNav={true} showLogout={true} />
        <ProfileNav />
        <main className="flex flex-1 flex-col overflow-y-auto pt-6 sm:pt-8 md:pt-0">{children}</main>
      </div>
    </I18nProvider>
  );
}
