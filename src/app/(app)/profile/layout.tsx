import type { Metadata } from "next";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";

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
      <div className="bg-background flex min-h-screen flex-col">
        <SiteHeader variant="authenticated" showNav={true} showLogout={true} />
        <div className="flex flex-1 flex-col pt-20 sm:pt-24">
          <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
