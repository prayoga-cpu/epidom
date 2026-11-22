import type { Locale } from "@/components/lang/i18n-provider";

/**
 * URL-prefix locale routing for the marketing site only (src/app/(marketing)).
 * `fr` is the default/primary market (docs/STRATEGY.md §3) and carries no
 * prefix — https://epidom.fr/pricing is French. `id`, `th` and `en` are prefixed
 * — /id/pricing, /th/pricing, /en/pricing. The (app) dashboard and (public) storefront
 * routes are NOT part of this scheme; storefront language is the merchant's
 * own content, and the dashboard uses its own client-side cookie switch.
 *
 * Implemented via middleware rewrite rather than an app/[locale] segment so
 * the existing (marketing) route tree, and every Link/import into it,
 * doesn't have to move — see src/middleware.ts.
 */
export const LOCALES: readonly Locale[] = ["fr", "id", "th", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_HEADER = "x-epidom-locale";

const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** Strip a leading /id, /th or /en prefix, returning the unprefixed path. */
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
 * Real HTTP cookie recording the visitor's own explicit language pick, made
 * via LangSwitcher on the marketing site (urlDriven mode) — takes priority
 * over the Accept-Language-based device-language detection below, since a
 * deliberate choice should always win and should keep winning on every
 * future visit to an unprefixed URL (a bookmark, the logo click, typing the
 * bare domain), not just the one that was open when they picked it. Must be
 * a real cookie rather than the localStorage-based preference in
 * src/lib/cookie-consent.ts: only a real cookie is readable from the Edge
 * proxy before any React code runs.
 */
export const LOCALE_PREF_COOKIE = "epidom_locale_pref";

/**
 * The language the signed-in app (dashboard, till, auth pages) is showing,
 * mirrored into a cookie by I18nProvider.setLocale. The app's own preference
 * lives in localStorage, which the server cannot read; this cookie is what lets
 * server-sent text (the verification and password-reset e-mails) match the
 * screen the person was looking at. It never drives a redirect.
 */
export const UI_LOCALE_COOKIE = "epidom_ui_locale";

/**
 * The language to write to someone the server knows only by their request:
 * the app's UI language, else the language they picked on the marketing site,
 * else their browser's when it is one we speak, else English.
 */
export function localeFromRequest(headers: Headers | null | undefined): Locale {
  if (!headers) return "en";
  const cookies = headers.get("cookie") ?? "";
  for (const name of [UI_LOCALE_COOKIE, LOCALE_PREF_COOKIE]) {
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([a-z]{2})(?:;|$)`));
    const found = LOCALES.find((l) => l === match?.[1]);
    if (found) return found;
  }
  const accept = headers.get("accept-language");
  if (!accept) return "en";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return LOCALES.find((l) => l === first) ?? "en";
}

/**
 * Best-guess locale from an Accept-Language header, e.g.
 * "en-US,en;q=0.9,fr;q=0.8" — re-evaluated on every visit to the unprefixed
 * (fr) site as long as no explicit LOCALE_PREF_COOKIE choice exists, so the
 * site always follows the visitor's current device language rather than
 * freezing a one-time guess. Never changes what a search engine/AI crawler
 * sees (see isLikelyBot).
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
    if (tag.startsWith("th")) return "th";
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
 *
 * Most crawlers say "bot" somewhere; the named tools after the generic words
 * don't: Search Console's URL inspection (Google-InspectionTool), Google's
 * other fetchers (GoogleOther), PageSpeed Insights/Lighthouse
 * (Chrome-Lighthouse), Bing's preview and Pinterest. Without them the URL
 * inspection tool and PageSpeed were sent to /en like an English browser and
 * reported on the wrong page.
 */
const BOT_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|applebot|ahrefsbot|semrushbot|mj12bot|gptbot|claude|anthropic|perplexitybot|ccbot|oai-searchbot|google-inspectiontool|googleother|chrome-lighthouse|bingpreview|pinterest/i;

export function isLikelyBot(userAgent: string | null): boolean {
  return userAgent ? BOT_USER_AGENT_PATTERN.test(userAgent) : false;
}
