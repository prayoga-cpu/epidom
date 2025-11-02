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
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
        <SiteHeader variant="authenticated" showNav={false} />
        <main className="flex flex-1 flex-col overflow-hidden pt-16 sm:pt-20 md:pt-20">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
