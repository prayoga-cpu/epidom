import type React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import type { Locale } from "@/components/lang/i18n-provider";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

vi.mock("next/navigation", () => ({
  usePathname: () => "/some/missing/page",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/lang/lang-switcher", () => ({ default: () => null }));

import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { NotFoundContent } from "../not-found-content";

// The real provider and the real dictionaries on purpose: what matters is the language
// the marketing shell actually prints, including for screen-reader users.

const DICTS: Record<Locale, unknown> = { en, fr, id };
const lookup = (locale: Locale, path: string) =>
  path.split(".").reduce<unknown>((acc, key) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined;
  }, DICTS[locale]) as string;

const YEAR = new Date().getFullYear();

const inLocale = (locale: Locale, ui: React.ReactNode) =>
  render(<EagerI18nProvider initialLocale={locale}>{ui}</EagerI18nProvider>);

const LOCALES = ["fr", "id", "en"] as const;

describe("SiteFooter speaks the visitor's language", () => {
  it.each([
    ["fr", `© ${YEAR} Epidom. Tous droits réservés.`, "Infrastructure par"],
    ["id", `© ${YEAR} Epidom. Hak cipta dilindungi.`, "Infrastruktur oleh"],
    ["en", `© ${YEAR} Epidom. All rights reserved.`, "Infrastructured by"],
  ] as const)("%s: copyright line and credit line", (locale, copyright, credit) => {
    const { container } = inLocale(locale, <SiteFooter />);

    expect(screen.getByText(copyright)).toBeInTheDocument();
    expect(screen.getByText(credit)).toBeInTheDocument();
    if (locale !== "en") {
      expect(container.textContent).not.toContain("All rights reserved");
      expect(container.textContent).not.toContain("Infrastructured by");
    }
    // Every key resolved: a missing one would print its own path.
    expect(container.textContent).not.toMatch(/\bfooter\.[a-z]/i);
  });

  it("keeps the version link next to the copyright, pointing at the localized changelog", () => {
    inLocale("id", <SiteFooter />);
    const version = screen.getByRole("link", { name: /^v\d/ });
    expect(version.getAttribute("href")).toBe("/id/changelog");
  });
});

describe("SiteHeader landmarks are announced in the visitor's language", () => {
  it.each(LOCALES)("%s: main header, main navigation and mobile menu", (locale) => {
    const { container } = inLocale(locale, <SiteHeader />);

    expect(
      screen.getByRole("navigation", { name: lookup(locale, "common.nav.mainHeader") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: lookup(locale, "common.nav.navTitle") })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(lookup(locale, "common.nav.openMenu")));
    expect(
      within(screen.getByRole("dialog")).getByRole("navigation", {
        name: lookup(locale, "common.nav.mobileMenu"),
      })
    ).toBeInTheDocument();

    // Every key resolved: a missing one would print its own path.
    expect(document.body.innerHTML).not.toMatch(/common\.nav\.[a-z]/i);
    if (locale !== "en") {
      for (const english of ["Main header", "Main navigation", "Mobile menu"]) {
        expect(container.innerHTML).not.toContain(`aria-label="${english}"`);
      }
      expect(document.querySelector('[aria-label="Mobile"]')).toBeNull();
    }
  });

  it("has real translations for the two new labels, not English reused", () => {
    for (const path of ["common.nav.mainHeader", "common.nav.mobileMenu"]) {
      expect(lookup("fr", path)).not.toBe(lookup("en", path));
      expect(lookup("id", path)).not.toBe(lookup("en", path));
    }
    expect(lookup("fr", "footer.infrastructuredBy")).not.toBe(
      lookup("en", "footer.infrastructuredBy")
    );
    expect(lookup("id", "footer.infrastructuredBy")).not.toBe(
      lookup("en", "footer.infrastructuredBy")
    );
  });
});

describe("NotFoundContent links stay in the visitor's language", () => {
  it.each([
    ["fr", "/contact", "/"],
    ["id", "/id/contact", "/id"],
    ["en", "/en/contact", "/en"],
  ] as const)("%s: the contact link is %s and 'back to home' is %s", (locale, contact, home) => {
    inLocale(locale, <NotFoundContent />);

    expect(
      screen
        .getByRole("link", { name: lookup(locale, "notFound.contactSupport") })
        .getAttribute("href")
    ).toBe(contact);
    expect(
      screen.getByRole("link", { name: lookup(locale, "notFound.backToHome") }).getAttribute("href")
    ).toBe(home);
  });
});
