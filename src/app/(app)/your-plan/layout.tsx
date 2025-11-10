import type { Metadata } from "next";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { ProfileNav } from "@/features/dashboard/profile/components/profile-nav";

export const metadata: Metadata = {
  title: "Your Plan - EPIDOM",
  description: "Manage and upgrade your subscription plan",
};

/**
 * Your Plan Page Layout
 *
 * Wraps your-plan page with I18nProvider and authentication UI
 */
export default function YourPlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <SiteHeader variant="authenticated" showNav={true} />
        <ProfileNav />
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </I18nProvider>
  );
}
