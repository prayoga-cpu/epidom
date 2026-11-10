import { getAllAppNavItems } from "@/config/navigation.config";
import { getDocsGuides } from "@/features/marketing/docs/content";
import { FEATURE_INDEX } from "@/features/dashboard/home/lib/feature-index";
import { SETTINGS_SECTIONS } from "@/features/dashboard/home/lib/settings-sections";
import { en } from "@/locales/en";
import type { Locale } from "@/components/lang/i18n-provider";

/**
 * The "docs of search" handed to the search assistant: every place a person can be sent
 * (pages, the cards on Settings, tabs/buttons/how-tos, and the Help guides), each with the same
 * id the client's search results use, so the model only ever names something that exists.
 */
export interface CatalogEntry {
  id: string;
  label: string;
  hint: string;
  /** Relative to /store/{id}. */
  href: string;
}

const get = (o: unknown, path: string): string | undefined => {
  const v = path
    .split(".")
    .reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
  return typeof v === "string" ? v : undefined;
};

export function buildSearchCatalog(locale: Locale): CatalogEntry[] {
  const pages = getAllAppNavItems().map((item) => ({
    id: `page-${item.href}`,
    label: get(en, item.labelKey) ?? item.href,
    hint: "",
    href: item.route ?? item.href,
  }));
  const settings = SETTINGS_SECTIONS.map((s) => ({
    id: `settings-${s.id}`,
    label: `Settings · ${get(en, s.labelKey) ?? s.id}`,
    hint: s.keywords.slice(0, 140),
    href: `/profile#${s.anchor}`,
  }));
  const features = FEATURE_INDEX.map((f) => ({
    id: `feat-${f.id}`,
    label: f.label.en,
    hint: f.keywords.slice(0, 140),
    href: f.href,
  }));
  const guides = getDocsGuides(locale).map((g) => ({
    id: `guide-${g.slug}`,
    label: `Guide: ${g.title}`,
    hint: g.description.slice(0, 140),
    href: `/help?guide=${encodeURIComponent(g.slug)}`,
  }));
  return [...pages, ...settings, ...features, ...guides];
}

/** The catalog as the compact text block the model reads. */
export function catalogToPrompt(catalog: CatalogEntry[]): string {
  return catalog.map((e) => `${e.id} | ${e.label}${e.hint ? ` | ${e.hint}` : ""}`).join("\n");
}
