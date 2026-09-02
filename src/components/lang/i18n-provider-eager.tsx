"use client";

import type React from "react";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { seedLocale, type Lang } from "@/locales";
import { I18nProvider, type Locale } from "./i18n-provider";

/**
 * Marketing-only provider that keeps every locale resident *before* the first
 * render, instead of code-splitting them the way the app's `I18nProvider`
 * does.
 *
 * Why marketing is the exception: its language comes from the URL, resolved in
 * middleware (`/pricing` is French, `/en/*` and `/id/*` are prefixed — see
 * `src/lib/i18n-routing.ts`). That language has to be in the server-rendered
 * HTML, because it exists for crawlers as much as for people. Loading it from
 * a chunk after hydration would mean serving a French URL with English markup
 * — a real SEO regression, not a cosmetic flash.
 *
 * The (app) dashboard, (public) storefront and (auth) screens have no such
 * constraint: they always start at English and switch from a cookie after
 * hydration anyway, so they use the split path and never pay for the two
 * languages the visitor isn't reading.
 *
 * Seeded at module scope so the dictionaries are in the registry by the time
 * the provider below first renders — on the server too, where this runs
 * during SSR. The data is static and identical per locale, so sharing the
 * registry across requests carries no per-user state.
 */
seedLocale("fr" as Lang, fr);
seedLocale("id" as Lang, id);

export function EagerI18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>;
}
