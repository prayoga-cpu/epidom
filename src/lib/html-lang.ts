import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALES } from "@/lib/i18n-routing";

/**
 * `lang` for the root <html>. The proxy stamps the request with the locale on
 * marketing paths only (src/proxy.ts, LOCALE_HEADER); every other route (the
 * dashboard, the storefront) has no such header and is English. The value is
 * checked against the known locales because on a path the proxy does not stamp,
 * a client can send the header itself.
 */
export function resolveHtmlLang(localeHeader: string | null | undefined): Locale {
  return LOCALES.find((locale) => locale === localeHeader) ?? "en";
}
