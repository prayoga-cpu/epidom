import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";

export const metadata: Metadata = {
  title: "Your Stores - EPIDOM",
  description: "Manage your stores",
};

export default async function StoresLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // The proxy only checks that a session cookie EXISTS (the Edge runtime can't
  // verify it against the DB), so an expired or revoked one gets this far. Without
  // this the page renders, its /api/stores call 401s, and the person is left on a
  // "Failed to load stores" screen instead of being sent to sign in.
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.deactivatedAt) {
    redirect("/profile");
  }

  return (
    <I18nProvider>
      <div className="bg-background flex h-[calc(100vh/var(--app-zoom,1))] flex-col overflow-hidden">
        <SiteHeader variant="authenticated" showNav={true} showLogout={true} />
        <main className="flex flex-1 flex-col overflow-hidden pt-20 sm:pt-24 md:pt-20">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
