import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  session: null as unknown,
  locale: "fr" as "fr" | "id" | "en",
  path: "/pricing",
  push: vi.fn(),
  signOut: vi.fn(async () => {}),
  trackEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => h.path,
  useRouter: () => ({ push: h.push }),
}));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: h.session }),
  signOut: h.signOut,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: h.trackEvent }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: h.locale }),
}));
vi.mock("@/components/lang/lang-switcher", () => ({
  default: () => <div data-testid="lang-switcher" />,
}));

import { SiteHeader } from "../site-header";

const SIGNED_IN = { user: { id: "u1" } };

/** The mobile menu is a Radix sheet: its content only exists once it is open. */
function openMobileMenu() {
  fireEvent.click(screen.getByLabelText("common.nav.openMenu"));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  h.session = null;
  h.locale = "fr";
  h.path = "/pricing";
});

describe("SiteHeader call-to-action", () => {
  it("signed out: one 'start trial' button on desktop, and the same one in the mobile menu", () => {
    render(<SiteHeader />);

    const desktop = screen.getByRole("button", { name: /nav\.startTrial/ });
    fireEvent.click(desktop);
    expect(h.trackEvent).toHaveBeenCalledWith("cta_click", {
      event_category: "engagement",
      event_label: "header_try_epidom",
      // jsdom's user agent names no device, so the button keeps "Start Trial".
      platform: "unknown",
    });
    expect(h.push).toHaveBeenLastCalledWith("/register");

    h.push.mockClear();
    const sheet = within(openMobileMenu());
    fireEvent.click(sheet.getByRole("button", { name: /nav\.startTrial/ }));
    expect(h.push).toHaveBeenLastCalledWith("/register");
  });

  it("signed out on a Mac: the button names the device, with its mark, on desktop and in the menu", () => {
    const ua = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15"
      );
    try {
      render(<SiteHeader />);
      const desktop = screen.getByRole("button", { name: /nav\.startOn/ });
      expect(desktop.querySelector("svg")).not.toBeNull();
      expect(screen.queryByRole("button", { name: /nav\.startTrial/ })).toBeNull();
      fireEvent.click(desktop);
      expect(h.trackEvent).toHaveBeenCalledWith("cta_click", {
        event_category: "engagement",
        event_label: "header_try_epidom",
        platform: "macos",
      });
      const sheet = within(openMobileMenu());
      expect(sheet.getByRole("button", { name: /nav\.startOn/ })).toBeInTheDocument();
    } finally {
      ua.mockRestore();
    }
  });

  it("signed in: 'Your stores' on desktop and in the mobile menu, both going to /stores", () => {
    h.session = SIGNED_IN;
    render(<SiteHeader />);

    expect(screen.queryByRole("button", { name: /nav\.startTrial/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /common\.nav\.stores/ }));
    expect(h.push).toHaveBeenLastCalledWith("/stores");

    h.push.mockClear();
    const sheet = within(openMobileMenu());
    fireEvent.click(sheet.getByRole("button", { name: /common\.nav\.stores/ }));
    expect(h.push).toHaveBeenLastCalledWith("/stores");
  });

  it("signed in with showLogout: a log-out button that signs out and returns home, on both layouts", async () => {
    h.session = SIGNED_IN;
    render(<SiteHeader showLogout />);

    expect(screen.queryByRole("button", { name: /common\.nav\.stores/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.logout" }));
    await waitFor(() => expect(h.push).toHaveBeenLastCalledWith("/"));
    expect(h.signOut).toHaveBeenCalledTimes(1);

    h.push.mockClear();
    const sheet = within(openMobileMenu());
    fireEvent.click(sheet.getByRole("button", { name: "common.actions.logout" }));
    await waitFor(() => expect(h.push).toHaveBeenLastCalledWith("/"));
    expect(h.signOut).toHaveBeenCalledTimes(2);
  });

  it("showLogout means nothing while signed out: still the 'start trial' button", () => {
    render(<SiteHeader showLogout />);
    expect(screen.getByRole("button", { name: /nav\.startTrial/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.actions.logout" })).toBeNull();
  });
});

describe("SiteHeader has no waitlist", () => {
  it.each([
    ["signed out", null, false],
    ["signed in", SIGNED_IN, false],
    ["signed in, logout variant", SIGNED_IN, true],
  ] as const)(
    "%s: nothing waitlist-shaped on desktop or in the mobile menu",
    (_label, session, logout) => {
      h.session = session;
      const { container } = render(<SiteHeader showLogout={logout} />);
      const desktopHtml = container.innerHTML;
      const mobileHtml = openMobileMenu().innerHTML;

      for (const html of [desktopHtml, mobileHtml]) {
        expect(html).not.toMatch(/waitlist/i);
      }
      // The third-party form's trigger button, by its old accessible name key.
      expect(screen.queryByLabelText("waitlist.openButtonAria")).toBeNull();
    }
  );
});

describe("SiteHeader navigation", () => {
  it.each([
    ["fr", "/pricing"],
    ["id", "/id/pricing"],
    ["en", "/en/pricing"],
  ] as const)("%s: the pricing link and the logo carry the locale prefix (%s)", (locale, href) => {
    h.locale = locale;
    const { container } = render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "common.nav.pricing" }).getAttribute("href")).toBe(
      href
    );
    // With no back arrow, the first link in the bar is the logo.
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      locale === "fr" ? "/" : `/${locale}`
    );
  });

  it("signed in (Your Stores, Profile): the logo is plain branding, not a way back to the website", () => {
    const { container } = render(<SiteHeader variant="authenticated" showLogout />);
    const home = [...container.querySelectorAll("a")].filter((a) =>
      ["/", "/en", "/id"].includes(a.getAttribute("href") ?? "")
    );
    expect(home).toHaveLength(0);
    expect(screen.queryByLabelText("common.actions.back")).toBeNull();
  });

  it.each([
    ["fr", "/compare"],
    ["id", "/id/compare"],
    ["en", "/en/compare"],
  ] as const)(
    "%s: Compare is in the Resources menu, and links to the section (%s)",
    (locale, href) => {
      h.locale = locale;
      render(<SiteHeader />);
      // The panel is shut (hidden), but its links are in the page.
      expect(
        screen.getByRole("link", { name: "footer.linkCompare", hidden: true }).getAttribute("href")
      ).toBe(href);
      // And it is no longer a top-level link.
      expect(screen.queryByRole("link", { name: "footer.linkCompare" })).toBeNull();
    }
  );

  it("marks Resources as the current section on a comparison sub-page, and Pricing as not", () => {
    h.path = "/compare/moka";
    render(<SiteHeader />);
    const resources = screen.getByRole("button", { name: "common.nav.resources" });
    expect(resources.closest("[data-current]")).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "common.nav.pricing" }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("has no Home link (the logo is Home) and no top-level Contact", () => {
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "common.nav.home" })).toBeNull();
    expect(screen.queryByRole("link", { name: "common.nav.contact" })).toBeNull();
    expect(screen.queryByRole("link", { name: "footer.linkContact" })).toBeNull();
    // Contact is under Resources.
    expect(
      screen.getByRole("link", { name: "footer.linkContact", hidden: true }).getAttribute("href")
    ).toBe("/contact");
  });

  it("never links to the retired /payments page", () => {
    render(<SiteHeader />);
    const sheet = openMobileMenu();
    for (const link of [...document.querySelectorAll("a"), ...sheet.querySelectorAll("a")]) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/\/payments/);
    }
  });

  it("marks the current page and renders a back arrow only when asked to", () => {
    const { rerender } = render(<SiteHeader />);
    expect(
      screen.getByRole("link", { name: "common.nav.pricing" }).getAttribute("aria-current")
    ).toBe("page");
    expect(screen.queryByLabelText("common.actions.back")).toBeNull();

    rerender(<SiteHeader backHref="/stores" />);
    expect(screen.getByLabelText("common.actions.back").getAttribute("href")).toBe("/stores");
  });
});

describe("SiteHeader log in", () => {
  it("signed out: a Log in link to /login on desktop and in the mobile menu", () => {
    render(<SiteHeader />);
    const desktop = screen.getByRole("link", { name: "common.nav.login" });
    expect(desktop.getAttribute("href")).toBe("/login");
    fireEvent.click(desktop);
    expect(h.trackEvent).toHaveBeenCalledWith("cta_click", {
      event_category: "engagement",
      event_label: "header_login",
    });
    const sheet = within(openMobileMenu());
    expect(sheet.getByRole("link", { name: "common.nav.login" }).getAttribute("href")).toBe(
      "/login"
    );
  });

  it("signed in: no Log in link anywhere", () => {
    h.session = SIGNED_IN;
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "common.nav.login" })).toBeNull();
    const sheet = within(openMobileMenu());
    expect(sheet.queryByRole("link", { name: "common.nav.login" })).toBeNull();
  });
});

describe("SiteHeader dropdown menus", () => {
  const productsChevron = () => screen.getByRole("button", { name: "common.nav.openSubmenu" });
  const resourcesButton = () => screen.getByRole("button", { name: "common.nav.resources" });

  it("Products: its label links to /products, and the chevron opens a menu of its spaces", () => {
    h.locale = "en";
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "common.nav.products" }).getAttribute("href")).toBe(
      "/en/products"
    );
    expect(productsChevron().getAttribute("aria-expanded")).toBe("false");
    // Shut: the links are in the page but not shown.
    expect(screen.queryByRole("link", { name: "redesign.landing.spaces.posName" })).toBeNull();

    fireEvent.click(productsChevron());
    expect(productsChevron().getAttribute("aria-expanded")).toBe("true");
    const hrefOf = (name: RegExp | string) =>
      screen.getByRole("link", { name }).getAttribute("href");
    expect(hrefOf(/^redesign\.landing\.spaces\.storefrontName/)).toBe("/en/products#storefront");
    expect(hrefOf(/^redesign\.landing\.spaces\.posName/)).toBe("/en/products#pos");
    expect(hrefOf(/^redesign\.landing\.spaces\.backOfficeName/)).toBe("/en/products#dashboard");
    // The Claude connector page is the one in the visitor's language.
    expect(hrefOf(/^common\.nav\.claudeConnector/)).toBe("/en/claude-connector-pos");
    expect(hrefOf("common.nav.viewAllProducts")).toBe("/en/products");
  });

  it.each([
    ["fr", "/connecteur-claude-caisse"],
    ["id", "/id/konektor-claude-kasir"],
  ] as const)("%s: the Claude connector link is that language's page (%s)", (locale, href) => {
    h.locale = locale;
    render(<SiteHeader />);
    expect(
      screen
        .getByRole("link", { name: /^common\.nav\.claudeConnector/, hidden: true })
        .getAttribute("href")
    ).toBe(href);
  });

  it("Resources: one button opens the tools and the learn-and-help links", () => {
    h.locale = "en";
    render(<SiteHeader />);
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(resourcesButton());
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("true");
    const hrefOf = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
    expect(hrefOf("common.nav.toolCommission")).toBe("/en/delivery-app-commission-calculator");
    expect(hrefOf("common.nav.toolRecipeCost")).toBe("/en/recipe-cost-calculator");
    expect(hrefOf("common.nav.toolQrMenu")).toBe("/en/free-qr-code-menu");
    expect(hrefOf("footer.linkBlog")).toBe("/en/blog");
    expect(hrefOf("footer.linkDocs")).toBe("/en/docs");
    expect(hrefOf("footer.linkChangelog")).toBe("/en/changelog");
  });

  it("only one menu is open at a time", () => {
    render(<SiteHeader />);
    fireEvent.click(productsChevron());
    expect(productsChevron().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(resourcesButton());
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("true");
    expect(productsChevron().getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape closes the open menu and puts focus back on its button", () => {
    render(<SiteHeader />);
    fireEvent.click(resourcesButton());
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(resourcesButton(), { key: "Escape" });
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(resourcesButton());
  });

  it("a click outside closes it", () => {
    render(<SiteHeader />);
    fireEvent.click(resourcesButton());
    fireEvent.mouseDown(document.body);
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("choosing a link closes the menu", () => {
    render(<SiteHeader />);
    fireEvent.click(resourcesButton());
    fireEvent.click(screen.getByRole("link", { name: "footer.linkBlog" }));
    expect(resourcesButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("mobile menu: Products and Resources are accordion rows; a row expands its links", () => {
    h.locale = "en";
    render(<SiteHeader />);
    const sheet = within(openMobileMenu());
    // Pricing stays a plain link; Products keeps its own page link; Contact is not a row.
    expect(sheet.getByRole("link", { name: "common.nav.pricing" })).toBeInTheDocument();
    expect(sheet.getByRole("link", { name: "common.nav.products" }).getAttribute("href")).toBe(
      "/en/products"
    );
    expect(sheet.queryByRole("link", { name: "footer.linkBlog" })).toBeNull();

    const resources = sheet.getByRole("button", { name: "common.nav.resources" });
    expect(resources.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(resources);
    expect(resources.getAttribute("aria-expanded")).toBe("true");
    expect(sheet.getByRole("link", { name: "footer.linkBlog" }).getAttribute("href")).toBe(
      "/en/blog"
    );

    fireEvent.click(sheet.getByRole("button", { name: "common.nav.openSubmenu" }));
    expect(
      sheet.getByRole("link", { name: /redesign\.landing\.spaces\.posName/ })
    ).toBeInTheDocument();
  });
});

describe("resolveMenu", () => {
  it("leaves out a landing page that has no version in the visitor's language, and an emptied section", async () => {
    const { resolveMenu } = await import("../../lib/landing-nav");
    const menu = {
      sections: [
        { links: [{ landing: "cafe" as const, labelKey: "a" }] },
        {
          links: [
            { landing: "cafe" as const, labelKey: "b" },
            { href: "/blog#x", labelKey: "c" },
          ],
        },
      ],
      footer: { href: "/products", labelKey: "f" },
    };
    // "cafe" exists in English and Indonesian only.
    const fr = resolveMenu(menu, "fr");
    expect(fr.sections).toHaveLength(1);
    expect(fr.sections[0].links.map((l) => l.href)).toEqual(["/blog#x"]);
    const en = resolveMenu(menu, "en");
    expect(en.sections).toHaveLength(2);
    expect(en.sections[0].links[0].href).toBe("/en/cafe-pos-system");
    expect(en.sections[1].links[1].href).toBe("/en/blog#x");
    expect(en.footer?.href).toBe("/en/products");
  });
});
