import type { Metadata } from "next";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";

export const metadata: Metadata = {
  title: "Your Stores - EPIDOM",
  description: "Manage your stores",
};

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <SiteHeader variant="authenticated" showNav={true} showLogout={true} />
        <main className="flex flex-1 flex-col overflow-hidden pt-20 sm:pt-24 md:pt-20">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
