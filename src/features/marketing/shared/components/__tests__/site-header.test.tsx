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
    });
    expect(h.push).toHaveBeenLastCalledWith("/register");

    h.push.mockClear();
    const sheet = within(openMobileMenu());
    fireEvent.click(sheet.getByRole("button", { name: /nav\.startTrial/ }));
    expect(h.push).toHaveBeenLastCalledWith("/register");
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
  ] as const)("%s: links to the Compare section (%s)", (locale, href) => {
    h.locale = locale;
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "common.nav.compare" }).getAttribute("href")).toBe(
      href
    );
  });

  it("marks Compare as the current section on a comparison sub-page, and not Home", () => {
    h.path = "/compare/moka";
    render(<SiteHeader />);
    expect(
      screen.getByRole("link", { name: "common.nav.compare" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "common.nav.home" }).getAttribute("aria-current")
    ).toBeNull();
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
