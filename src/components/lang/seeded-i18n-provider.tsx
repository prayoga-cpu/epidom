"use client";

import type React from "react";
import dynamic from "next/dynamic";
import type { Locale } from "./i18n-provider";

/**
 * An i18n provider whose language is resident before the first render, on
 * the server too, so the server HTML is already in that language (it exists
 * for crawlers as much as for people), and which ships ONLY that language.
 *
 * Each language lives in its own client module, imported lazily FROM THIS
 * CLIENT MODULE, so a page loads the dictionary it renders and not the other
 * two. (The same next/dynamic calls in a server component did not split: the
 * build put every language's chunk in the page's script tags.) Switching
 * language later still works: I18nProvider loads the other chunk on demand.
 *
 * - Marketing site: the URL decides the language (`/`, `/id/*`, `/en/*`), so
 *   it is fixed (`initialLocale`).
 * - Public storefront: the server renders the store's own language, then the
 *   visitor's saved choice or browser language takes over after hydration,
 *   as before (`followVisitorPreference`).
 */
const FrenchSeededI18nProvider = dynamic(() =>
  import("./seeded-i18n-fr").then((m) => m.FrenchSeededI18nProvider)
);
const IndonesianSeededI18nProvider = dynamic(() =>
  import("./seeded-i18n-id").then((m) => m.IndonesianSeededI18nProvider)
);
const EnglishSeededI18nProvider = dynamic(() =>
  import("./seeded-i18n-en").then((m) => m.EnglishSeededI18nProvider)
);

export function SeededI18nProvider({
  locale,
  followVisitorPreference = false,
  children,
}: {
  locale: Locale;
  followVisitorPreference?: boolean;
  children: React.ReactNode;
}) {
  const Provider =
    locale === "fr"
      ? FrenchSeededI18nProvider
      : locale === "id"
        ? IndonesianSeededI18nProvider
        : EnglishSeededI18nProvider;
  return <Provider followVisitorPreference={followVisitorPreference}>{children}</Provider>;
}
