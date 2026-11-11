import type { Locale } from "@/components/lang/i18n-provider";
import type { LandingMenu, LandingMenuLink } from "@/config/navigation.config";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { getLocalizedPath } from "@/lib/i18n-routing";

/** A menu link with its address worked out for the visitor's language. */
export interface ResolvedMenuLink extends Omit<LandingMenuLink, "href" | "landing"> {
  href: string;
}

export interface ResolvedMenu {
  sections: { headingKey?: string; links: ResolvedMenuLink[] }[];
  footer?: { href: string; labelKey: string };
}

/**
 * A dropdown's links as the visitor can open them: site paths get the language
 * prefix ("/en/blog"; a "#pos" hash is kept), a landing page is the one written
 * in their language, and a landing page that has no version in it (the café and
 * restaurant pages exist in English and Indonesian only, for instance) is left
 * out, as is a section left with no links.
 */
export function resolveMenu(menu: LandingMenu, locale: Locale): ResolvedMenu {
  const resolveLink = (link: LandingMenuLink): ResolvedMenuLink | null => {
    const { href, landing, ...rest } = link;
    if (landing) {
      const slug = (LANDING_GROUPS[landing] as Partial<Record<Locale, string>>)[locale];
      return slug ? { ...rest, href: getLocalizedPath(`/${slug}`, locale) } : null;
    }
    if (!href) return null;
    const [path, hash] = href.split("#");
    return { ...rest, href: getLocalizedPath(path, locale) + (hash ? `#${hash}` : "") };
  };

  return {
    sections: menu.sections
      .map((section) => ({
        headingKey: section.headingKey,
        links: section.links.map(resolveLink).filter((l): l is ResolvedMenuLink => l !== null),
      }))
      .filter((section) => section.links.length > 0),
    footer: menu.footer
      ? { ...menu.footer, href: getLocalizedPath(menu.footer.href, locale) }
      : undefined,
  };
}
