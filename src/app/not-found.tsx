import { generateMetadata as genMeta } from "@/lib/seo";
import { NotFoundContent } from "@/features/marketing/shared/components/not-found-content";
import { I18nProvider } from "@/components/lang/i18n-provider";

/**
 * 404 Not Found Page (Root Level)
 *
 * Shown when user navigates to a page that doesn't exist
 * Uses marketing branding and multilanguage support
 */
export const metadata = genMeta({
  title: "Page Not Found - EPIDOM",
  description: "The page you're looking for doesn't exist",
});

export default function NotFound() {
  return (
    <I18nProvider>
      <main className="min-h-screen bg-white" style={{ color: "var(--color-brand-primary)" }}>
        <NotFoundContent showDashboardButton={true} />
      </main>
    </I18nProvider>
  );
}
