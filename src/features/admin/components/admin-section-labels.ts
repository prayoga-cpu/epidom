import type { AdminSectionGroup, AdminSectionKey } from "@/config/admin-sections.config";

type Translate = (key: string) => string;

/** "custom-development" → "customDevelopment": locale keys can't hold hyphens. */
const camel = (key: string) => key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * The admin pages' names, grant warnings and menu groups in the viewer's
 * language (adminNav.* in the locale files). The English in
 * admin-sections.config.ts stays the fallback, so a page added there without a
 * translation still shows its name instead of a raw key.
 */
function translated(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

export function adminSectionLabel(t: Translate, key: AdminSectionKey, fallback: string): string {
  return translated(t, `adminNav.sections.${camel(key)}`, fallback);
}

export function adminSectionWarning(t: Translate, key: AdminSectionKey, fallback: string): string {
  return translated(t, `adminNav.warnings.${camel(key)}`, fallback);
}

export function adminGroupLabel(t: Translate, key: AdminSectionGroup, fallback: string): string {
  return translated(t, `adminNav.groups.${key}`, fallback);
}
