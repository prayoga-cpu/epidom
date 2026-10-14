import type React from "react";
import { SeededI18nProvider } from "@/components/lang/seeded-i18n-provider";
import { StoreLanguage } from "@/features/storefront/components/store-language";
import {
  cleanStorefrontSlug,
  getPublicStorefront,
  storefrontLocaleOf,
} from "@/features/storefront/lib/public-storefront";

/**
 * Every page of a storefront (/@slug, its menu, items, orders) is served in
 * the store's own language, so the server HTML a crawler or a first visit
 * sees reads like the shop instead of English. The visitor's own choice or
 * browser language still takes over after hydration, as before. The lookup
 * is shared with the page through getPublicStorefront (one query).
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storefront = await getPublicStorefront(cleanStorefrontSlug(slug));
  const locale = storefront ? storefrontLocaleOf(storefront) : "en";

  return (
    <SeededI18nProvider locale={locale} followVisitorPreference>
      <StoreLanguage>{children}</StoreLanguage>
    </SeededI18nProvider>
  );
}
