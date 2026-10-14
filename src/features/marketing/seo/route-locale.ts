import type { Locale } from "@/components/lang/i18n-provider";
import { DEFAULT_LOCALE } from "@/lib/i18n-routing";

/**
 * Marketing pages live under src/app/(marketing)/m/[locale]/: the proxy
 * rewrites `/pricing` to `/m/fr/pricing` and `/id/pricing` to `/m/id/pricing`,
 * so a page learns its language from the route, statically, instead of from a
 * request header (which made every marketing page render on each request).
 */
export type LocaleParams = { params: Promise<{ locale: string }> };

export function toLocale(value: string | undefined): Locale {
  return value === "en" || value === "fr" || value === "id" ? value : DEFAULT_LOCALE;
}

export async function routeLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  return toLocale((await params).locale);
}
