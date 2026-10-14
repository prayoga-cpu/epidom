import { cache } from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import { storefrontService } from "@/lib/services";
import { formatCurrency } from "@/lib/utils/formatting";

/**
 * One storefront lookup per request, shared by the /@slug layout (which needs
 * the store's language) and the page under it (metadata + body). React's
 * cache() only dedupes calls through the same function, so everything under
 * /@slug imports this one.
 */
export const getPublicStorefront = cache((slug: string) =>
  storefrontService.getStorefrontBySlug(slug)
);

/** The `[slug]` route param as the storefront slug: "%40cafe" or "@cafe" → "cafe". */
export function cleanStorefrontSlug(param: string): string {
  return decodeURIComponent(param).replace(/^@/, "");
}

/**
 * The language a storefront is served in before the visitor's own preference
 * applies.
 *
 * The store's currency decides first: the owner sets it for their own prices,
 * so it says which market the shop is in (rupiah → Indonesian, euro → French).
 * The business's language comes second, because it is often a leftover
 * default rather than a choice (the column defaults to "id": a Paris café
 * pricing in euros was stored as Indonesian), so an "id" there only counts
 * for a rupiah store, and anything else falls back to English.
 */
export function resolveStorefrontLocale({
  currency,
  businessLocale,
}: {
  currency?: string | null;
  businessLocale?: string | null;
}): Locale {
  if (currency === "IDR") return "id";
  if (currency === "EUR") return "fr";
  return businessLocale === "fr" || businessLocale === "en" ? businessLocale : "en";
}

/** The language for a storefront as getPublicStorefront returns it. */
export function storefrontLocaleOf(storefront: {
  store: { currency: string; business: { locale: string | null } };
}): Locale {
  return resolveStorefrontLocale({
    currency: storefront.store.currency,
    businessLocale: storefront.store.business.locale,
  });
}

/** `Intl` tag for formatting a storefront's prices in its own language. */
const PRICE_LOCALE: Record<Locale, string> = { fr: "fr-FR", id: "id-ID", en: "en-US" };

/**
 * Rupiah always reads "Rp 25.000", as on the menu page (formatCurrency's
 * default), whatever the store's language: that is how prices look on a Bali
 * café's menu for its English-speaking guests too.
 */
export function formatStorefrontPrice(value: number, currency: string, locale: Locale): string {
  return formatCurrency(value, currency, currency === "IDR" ? "id-ID" : PRICE_LOCALE[locale]);
}

interface HighlightSource {
  name: string;
  price: unknown;
  isAvailable: boolean;
  isFeatured: boolean;
}

/**
 * A few dishes for the storefront's profile page, so the page that ranks for
 * the shop's name says what it serves (the full menu is one tap away):
 * featured items first, then the menu's own order, available ones only.
 */
export function pickMenuHighlights(
  menuCategories: ReadonlyArray<{ items: ReadonlyArray<HighlightSource> }>,
  { currency, locale, limit = 6 }: { currency: string; locale: Locale; limit?: number }
): Array<{ name: string; price: string }> {
  const available = menuCategories.flatMap((c) => c.items).filter((i) => i.isAvailable);
  const ordered = [
    ...available.filter((i) => i.isFeatured),
    ...available.filter((i) => !i.isFeatured),
  ];
  return ordered.slice(0, limit).map((item) => ({
    name: item.name,
    price: formatStorefrontPrice(Number(item.price), currency, locale),
  }));
}

/** "Rp 3.000 – Rp 25.000" for schema.org `priceRange`, or undefined without priced items. */
export function menuPriceRange(
  menuCategories: ReadonlyArray<{ items: ReadonlyArray<HighlightSource> }>,
  { currency, locale }: { currency: string; locale: Locale }
): string | undefined {
  const prices = menuCategories
    .flatMap((c) => c.items)
    .filter((i) => i.isAvailable)
    .map((i) => Number(i.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return undefined;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const fmt = (v: number) => formatStorefrontPrice(v, currency, locale);
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}
