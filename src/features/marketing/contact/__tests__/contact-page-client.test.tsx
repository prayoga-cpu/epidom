import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import {
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_MAILTO,
  WHATSAPP_NUMBERS,
  whatsappHref,
} from "@/lib/constants/contact";

type Loc = "fr" | "id" | "en";

// The real dictionaries, looked up exactly like the provider's t() does, except
// that a key missing from the ACTIVE locale is recorded instead of silently
// falling back to English. That is what "renders without missing keys" means.
const h = vi.hoisted(() => {
  const lookup = (tree: unknown, path: string): unknown =>
    path
      .split(".")
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
        tree
      );
  return {
    lookup,
    locale: "fr" as "fr" | "id" | "en",
    dictionaries: {} as Record<string, unknown>,
    missing: new Set<string>(),
    trackConversion: vi.fn(),
  };
});

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    locale: h.locale,
    t: (key: string) => {
      const value = h.lookup(h.dictionaries[h.locale], key);
      if (typeof value !== "string") {
        h.missing.add(`${h.locale}:${key}`);
        return key;
      }
      return value;
    },
  }),
}));

vi.mock("@/lib/analytics", () => ({ trackConversion: h.trackConversion }));

import { ContactPageClient } from "../components/contact-page-client";

h.dictionaries = { en, fr, id };

const LOCALES: Loc[] = ["fr", "id", "en"];

function text(locale: Loc, path: string): string {
  const value = h.lookup(h.dictionaries[locale], path);
  if (typeof value !== "string") throw new Error(`${locale} is missing ${path}`);
  return value;
}

function renderPage(locale: Loc) {
  h.locale = locale;
  h.missing.clear();
  return render(<ContactPageClient />);
}

/** The big gold buttons in the hero, not the secondary WhatsApp cards. */
function primaryWhatsAppLinks(locale: Loc): HTMLAnchorElement[] {
  const label = text(locale, "contact.page.whatsappPrimary");
  return screen.getAllByRole("link", { name: new RegExp(label) }) as HTMLAnchorElement[];
}

function allWhatsAppLinks(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="https://wa.me/"]'));
}

// jsdom logs "not implemented: navigation" when an anchor click is not cancelled.
const cancelNavigation = (e: Event) => e.preventDefault();

beforeEach(() => {
  document.addEventListener("click", cancelNavigation);
});

afterEach(() => {
  document.removeEventListener("click", cancelNavigation);
});

describe("ContactPageClient: WhatsApp is the primary action", () => {
  it("fr: one button, the France number, with the French message prefilled", () => {
    renderPage("fr");
    const links = primaryWhatsAppLinks("fr");
    const message = text("fr", "contact.page.whatsappMessage");

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(whatsappHref(WHATSAPP_NUMBERS.fr.number, message));
    expect(links[0].href.startsWith(`https://wa.me/${WHATSAPP_NUMBERS.fr.number}?text=`)).toBe(
      true
    );
    expect(new URL(links[0].href).searchParams.get("text")).toBe(message);
  });

  it("id: one button, the Indonesia number, with the Indonesian message prefilled", () => {
    renderPage("id");
    const links = primaryWhatsAppLinks("id");
    const message = text("id", "contact.page.whatsappMessage");

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(whatsappHref(WHATSAPP_NUMBERS.id.number, message));
    expect(new URL(links[0].href).searchParams.get("text")).toBe(message);
  });

  it("en: one button per number, France first, each labelled with its market", () => {
    renderPage("en");
    const links = primaryWhatsAppLinks("en");
    const message = text("en", "contact.page.whatsappMessage");

    expect(links).toHaveLength(2);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      whatsappHref(WHATSAPP_NUMBERS.fr.number, message),
      whatsappHref(WHATSAPP_NUMBERS.id.number, message),
    ]);
    expect(links[0]).toHaveTextContent(`(${WHATSAPP_NUMBERS.fr.label})`);
    expect(links[1]).toHaveTextContent(`(${WHATSAPP_NUMBERS.id.label})`);
  });

  it("URL-encodes the message and leaves no raw whitespace in the href", () => {
    renderPage("fr");
    const [link] = primaryWhatsAppLinks("fr");
    const message = text("fr", "contact.page.whatsappMessage");

    expect(link.getAttribute("href")).toContain(encodeURIComponent(message));
    expect(link.getAttribute("href")).not.toMatch(/\s/);
  });

  it("opens WhatsApp in a new tab safely", () => {
    const { container } = renderPage("en");
    const links = allWhatsAppLinks(container);

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("is full-width on mobile and at least 44px tall", () => {
    renderPage("fr");
    const [link] = primaryWhatsAppLinks("fr");

    expect(link.className).toContain("w-full");
    expect(link.className).toContain("min-h-[52px]");
  });

  it("comes before the secondary channels in the page", () => {
    renderPage("fr");
    const [primary] = primaryWhatsAppLinks("fr");
    const secondary = screen.getByRole("heading", { level: 2 });

    expect(
      primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("every WhatsApp link on the page carries the prefilled message", () => {
    for (const locale of LOCALES) {
      const { container, unmount } = renderPage(locale);
      const links = allWhatsAppLinks(container);
      const message = text(locale, "contact.page.whatsappMessage");
      // The primary buttons plus one secondary card per number.
      const numbers = locale === "en" ? 2 : 1;

      expect(links).toHaveLength(numbers * 2);
      for (const link of links) {
        expect(new URL(link.href).searchParams.get("text")).toBe(message);
      }
      unmount();
    }
  });
});

describe("ContactPageClient: analytics", () => {
  beforeEach(() => {
    h.trackConversion.mockClear();
  });

  it("fires contact_whatsapp with the contact_page label when the primary button is clicked", () => {
    renderPage("fr");
    fireEvent.click(primaryWhatsAppLinks("fr")[0]);

    expect(h.trackConversion).toHaveBeenCalledTimes(1);
    expect(h.trackConversion).toHaveBeenCalledWith("contact_whatsapp", {
      event_label: "contact_page",
    });
  });

  it("counts the second en button as the same conversion", () => {
    renderPage("en");
    fireEvent.click(primaryWhatsAppLinks("en")[1]);

    expect(h.trackConversion).toHaveBeenCalledTimes(1);
    expect(h.trackConversion).toHaveBeenCalledWith("contact_whatsapp", {
      event_label: "contact_page",
    });
  });

  it("also fires when the secondary WhatsApp card is used", () => {
    const { container } = renderPage("id");
    const card = allWhatsAppLinks(container).find(
      (a) => !a.textContent?.includes(text("id", "contact.page.whatsappPrimary"))
    );

    expect(card).toBeDefined();
    fireEvent.click(card!);
    expect(h.trackConversion).toHaveBeenCalledWith("contact_whatsapp", {
      event_label: "contact_page",
    });
  });

  it("does not fire for the email or docs links", () => {
    const { container } = renderPage("fr");
    fireEvent.click(container.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')!);
    fireEvent.click(container.querySelector<HTMLAnchorElement>('a[href="/docs"]')!);

    expect(h.trackConversion).not.toHaveBeenCalled();
  });
});

describe("ContactPageClient: secondary channels", () => {
  it("builds the email card from the shared support constants", () => {
    const { container } = renderPage("fr");
    const mailLinks = container.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]');

    expect(mailLinks).toHaveLength(1);
    expect(mailLinks[0].getAttribute("href")).toBe(SUPPORT_MAILTO);
    expect(mailLinks[0]).toHaveTextContent(SUPPORT_EMAIL_DISPLAY);
  });

  it("does not hardcode a support address in the component", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/contact-page-client.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/@prionation\.io/);
    expect(source).not.toMatch(/mailto:/);
  });

  it("links the docs card to the docs in the visitor's own language", () => {
    const expected: Record<Loc, string> = { fr: "/docs", id: "/id/docs", en: "/en/docs" };
    for (const locale of LOCALES) {
      const { container, unmount } = renderPage(locale);
      expect(container.querySelector(`a[href="${expected[locale]}"]`)).not.toBeNull();
      unmount();
    }
  });

  it("keeps email, WhatsApp and docs, with one WhatsApp card per number", () => {
    const fr = renderPage("fr");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    fr.unmount();

    renderPage("en");
    // email + France + Indonesia + docs
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });

  it("gives identical WhatsApp cards a distinguishing accessible name on en", () => {
    renderPage("en");
    // Anchored: the hero buttons read "Chat on WhatsApp (France)" and must not match.
    for (const { label } of [WHATSAPP_NUMBERS.fr, WHATSAPP_NUMBERS.id]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`^WhatsApp \\(${label}\\)`) })
      ).toBeInTheDocument();
    }
  });
});

describe("ContactPageClient: the fake form is gone", () => {
  it("renders no form and no form controls", () => {
    for (const locale of LOCALES) {
      const { container, unmount } = renderPage(locale);
      expect(container.querySelector("form")).toBeNull();
      expect(container.querySelector("input, textarea, select")).toBeNull();
      expect(container.querySelector('button[type="submit"]')).toBeNull();
      unmount();
    }
  });

  it("keeps no fake-send delay, in the source or at runtime", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/contact-page-client.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/setTimeout/);
    expect(source).not.toMatch(/<form\b/);
    expect(source).not.toMatch(/onSubmit/);

    const timer = vi.spyOn(globalThis, "setTimeout");
    try {
      renderPage("fr");
      fireEvent.click(primaryWhatsAppLinks("fr")[0]);
      expect(timer).not.toHaveBeenCalledWith(expect.any(Function), 1200);
    } finally {
      timer.mockRestore();
    }
  });

  it("no longer has any of the form-only strings in any locale", () => {
    const removed = [
      "contact.page.formName",
      "contact.page.formNamePlaceholder",
      "contact.page.formEmail",
      "contact.page.formEmailPlaceholder",
      "contact.page.formSubject",
      "contact.page.formMessage",
      "contact.page.formMessagePlaceholder",
      "contact.page.formSend",
      "contact.page.formSending",
      "contact.page.formSuccess",
      "contact.page.formError",
    ];
    for (const locale of LOCALES) {
      for (const path of removed) {
        expect(h.lookup(h.dictionaries[locale], path), `${locale}:${path}`).toBeUndefined();
      }
    }
  });
});

describe("ContactPageClient: no unsourced promises", () => {
  it.each(LOCALES)("%s: no average-response-time pill and no fixed support hours", (locale) => {
    const { container } = renderPage(locale);
    const shown = container.textContent ?? "";

    // The pill used to read "Avg. response time · < 4 h": a figure nobody measures.
    expect(shown).not.toMatch(/<\s*4\s*(h|jam)/i);
    expect(shown).not.toMatch(/avg\.? response|temps de réponse moyen|rata-rata waktu/i);
    // "8 am – 8 pm WIB" is 03:00-15:00 in Paris: misleading on the primary market's card.
    expect(shown).not.toMatch(/\bWIB\b/);
    expect(shown).not.toMatch(/8\s?(am|h)\b|08\.00|20\.00|8\s?pm/i);
    // The dot-and-text pill container is gone too, not just its text.
    expect(container.querySelector(".rounded-full.border.inline-flex")).toBeNull();
  });

  it("removed the response-time strings from every locale", () => {
    for (const locale of LOCALES) {
      for (const key of ["responseTime", "responseVal"]) {
        expect(
          h.lookup(h.dictionaries[locale], `contact.page.${key}`),
          `${locale}:${key}`
        ).toBeUndefined();
      }
    }
  });

  it.each(LOCALES)(
    "%s: keeps the 24-hour commitment and shows the WhatsApp card without hours",
    (locale) => {
      renderPage(locale);

      expect(screen.getByText(text(locale, "contact.page.script"))).toBeInTheDocument();
      expect(text(locale, "contact.page.script")).toContain("24");
      expect(screen.getAllByText(text(locale, "contact.page.channel2body")).length).toBeGreaterThan(
        0
      );
      expect(text(locale, "contact.page.channel2body")).not.toMatch(/\d/);
    }
  );
});

describe("ContactPageClient: locales", () => {
  it.each(LOCALES)("%s renders every string from its own dictionary", (locale) => {
    const { container } = renderPage(locale);

    expect([...h.missing]).toEqual([]);
    expect(container.textContent).not.toMatch(/contact\.page\./);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain(text(locale, "contact.page.titleAccent"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      text(locale, "contact.page.orTitle")
    );
  });

  it("has every contact.page string in all three locales", () => {
    const keys = [
      "eyebrow",
      "title1",
      "titleAccent",
      "title2",
      "script",
      "orTitle",
      "whatsappPrimary",
      "whatsappMessage",
      "whatsappCta",
      "channel1title",
      "channel1body",
      "channel2title",
      "channel2body",
      "channel3title",
      "channel3body",
      "channel3cta",
    ];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = h.lookup(h.dictionaries[locale], `contact.page.${key}`);
        expect(typeof value, `${locale}:contact.page.${key}`).toBe("string");
        expect((value as string).length, `${locale}:contact.page.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
