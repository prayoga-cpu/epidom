import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_MAILTO,
  WHATSAPP_NUMBERS,
  whatsappHref,
} from "@/lib/constants/contact";

const h = vi.hoisted(() => ({ locale: "fr" as "fr" | "id" | "en" }));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: h.locale }),
}));

import { SiteFooter } from "../site-footer";

beforeEach(() => {
  h.locale = "fr";
});

describe("SiteFooter contact column", () => {
  it("the email link is the shared support mailto, and shows the shared display text", () => {
    render(<SiteFooter />);

    const link = screen.getByRole("link", { name: SUPPORT_EMAIL_DISPLAY });
    expect(link.getAttribute("href")).toBe(SUPPORT_MAILTO);
    // Exactly one mailto in the footer: no second, hand-typed copy.
    expect(document.querySelectorAll('a[href^="mailto:"]')).toHaveLength(1);
  });

  it("still shows the location line from the locale (it is a place, not the email)", () => {
    render(<SiteFooter />);
    expect(screen.getByText("footer.address")).toBeInTheDocument();
  });

  it.each([
    ["fr", [{ name: "WhatsApp", href: whatsappHref(WHATSAPP_NUMBERS.fr.number) }]],
    ["id", [{ name: "WhatsApp", href: whatsappHref(WHATSAPP_NUMBERS.id.number) }]],
    [
      "en",
      [
        { name: "WhatsApp (France)", href: whatsappHref(WHATSAPP_NUMBERS.fr.number) },
        { name: "WhatsApp (Indonesia)", href: whatsappHref(WHATSAPP_NUMBERS.id.number) },
      ],
    ],
  ] as const)("%s: offers that market's WhatsApp number(s)", (locale, expected) => {
    h.locale = locale;
    render(<SiteFooter />);

    for (const { name, href } of expected) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }
    expect(screen.queryAllByRole("link", { name: /^WhatsApp/ })).toHaveLength(expected.length);
  });
});

describe("SiteFooter links", () => {
  it.each([
    ["fr", "/pricing"],
    ["id", "/id/pricing"],
    ["en", "/en/pricing"],
  ] as const)("%s: the pricing link is %s", (locale, href) => {
    h.locale = locale;
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "footer.linkPricing" }).getAttribute("href")).toBe(
      href
    );
  });

  it("does not link to the retired /payments page", () => {
    render(<SiteFooter />);
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/\/payments/);
    }
  });
});

describe("SiteFooter Manage cookies control", () => {
  it("renders a button that asks the consent bar to reopen", async () => {
    const { COOKIE_CONSENT_OPEN_EVENT } = await import("@/lib/cookie-consent");
    const onOpen = vi.fn();
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);

    render(<SiteFooter />);
    screen.getByRole("button", { name: "footer.manageCookies" }).click();

    window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("is not a link: it must not navigate away from the page being read", () => {
    render(<SiteFooter />);
    expect(screen.queryByRole("link", { name: "footer.manageCookies" })).toBeNull();
  });
});
