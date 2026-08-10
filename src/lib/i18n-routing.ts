import type { Locale } from "@/components/lang/i18n-provider";

/**
 * URL-prefix locale routing for the marketing site only (src/app/(marketing)).
 * `fr` is the default/primary market (docs/STRATEGY.md §3) and carries no
 * prefix — https://epidom.fr/pricing is French. `id` and `en` are prefixed
 * — /id/pricing, /en/pricing. The (app) dashboard and (public) storefront
 * routes are NOT part of this scheme; storefront language is the merchant's
 * own content, and the dashboard uses its own client-side cookie switch.
 *
 * Implemented via middleware rewrite rather than an app/[locale] segment so
 * the existing (marketing) route tree, and every Link/import into it,
 * doesn't have to move — see src/middleware.ts.
 */
export const LOCALES: readonly Locale[] = ["fr", "id", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_HEADER = "x-epidom-locale";

const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** Strip a leading /id or /en prefix, returning the unprefixed path. */
export function stripLocalePrefix(pathname: string): { locale: Locale; basePath: string } {
  for (const locale of PREFIXED_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const basePath = pathname.slice(`/${locale}`.length) || "/";
      return { locale, basePath };
    }
  }
  return { locale: DEFAULT_LOCALE, basePath: pathname };
}

/** Build the URL path for `basePath` (unprefixed, e.g. "/pricing") in `locale`. */
export function getLocalizedPath(basePath: string, locale: Locale): string {
  const normalized = basePath === "/" ? "" : basePath;
  if (locale === DEFAULT_LOCALE) return normalized || "/";
  return `/${locale}${normalized}`;
}

/**
 * Cookie marking "this visitor's browser-language auto-redirect decision
 * has already been made" — set on first visit to the unprefixed (fr) site
 * so we redirect an English/Indonesian browser to /en or /id at most once,
 * not on every request (and not fight a visitor who deliberately navigates
 * back to the French pages afterwards). A real HTTP cookie, not the
 * localStorage-based preference in src/lib/cookie-consent.ts — that one
 * isn't readable from the Edge proxy.
 */
export const LOCALE_REDIRECT_COOKIE = "epidom_locale_redirect_seen";

/**
 * Real HTTP cookie recording the visitor's own explicit language pick, made
 * via LangSwitcher on the marketing site (urlDriven mode) — takes priority
 * over the one-time Accept-Language guess above, since a deliberate choice
 * should always win and should keep winning on every future visit to an
 * unprefixed URL (a bookmark, the logo click, typing the bare domain),
 * not just the one that was open when they picked it. Same reasoning as
 * LOCALE_REDIRECT_COOKIE for why this must be a real cookie rather than the
 * localStorage-based preference in src/lib/cookie-consent.ts: only a real
 * cookie is readable from the Edge proxy before any React code runs.
 */
export const LOCALE_PREF_COOKIE = "epidom_locale_pref";

/**
 * Best-guess locale from an Accept-Language header, e.g.
 * "en-US,en;q=0.9,fr;q=0.8" — used only to decide a one-time redirect for
 * first-time visitors hitting the unprefixed (fr) site; never changes what
 * a search engine/AI crawler sees (see isLikelyBot).
 */
export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), q: qPart ? parseFloat(qPart) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag.startsWith("id")) return "id";
    if (tag.startsWith("en")) return "en";
    if (tag.startsWith("fr")) return "fr";
  }
  return DEFAULT_LOCALE;
}

/**
 * Search engine and AI-answer-engine crawlers must always see the
 * canonical (fr, unprefixed) content at "/" — never redirected by guessed
 * language, per Google's own guidance against geo/language auto-redirects
 * breaking crawlability. Matched case-insensitively against User-Agent.
 */
const BOT_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|applebot|ahrefsbot|semrushbot|mj12bot|gptbot|claude|anthropic|perplexitybot|ccbot|oai-searchbot/i;

export function isLikelyBot(userAgent: string | null): boolean {
  return userAgent ? BOT_USER_AGENT_PATTERN.test(userAgent) : false;
}
