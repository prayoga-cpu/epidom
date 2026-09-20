import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

type L = "en" | "fr" | "id";
const DICTS: Record<L, unknown> = { en, fr, id };
const h = vi.hoisted(() => ({ locale: "en" as "en" | "fr" | "id" }));

const lookup = (dict: unknown, path: string) =>
  path.split(".").reduce<unknown>((acc, key) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined;
  }, dict);

// Strict: a key missing from a locale renders as MISSING(key) instead of falling back to English.
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    locale: h.locale,
    t: (key: string) => {
      const v = lookup(DICTS[h.locale], key);
      // Function-valued entries (footer.rights) are called with the year, as the real provider does.
      if (typeof v === "function") return (v as (year: number) => string)(new Date().getFullYear());
      return typeof v === "string" ? v : `MISSING(${key})`;
    },
  }),
}));

import { CookieConsentBar } from "../cookie-consent-bar";
import { SiteFooter } from "../site-footer";
import {
  COOKIE_CONSENT_OPEN_EVENT,
  getCookiePreferences,
  hasConsentChoice,
  setCookiePreferences,
  setLanguagePreference,
} from "@/lib/cookie-consent";

const text = (locale: L, path: string) => lookup(DICTS[locale], path) as string;

function renderPage() {
  return render(
    <>
      <SiteFooter />
      <CookieConsentBar />
    </>
  );
}

const openFromFooter = () =>
  fireEvent.click(screen.getByRole("button", { name: text(h.locale, "footer.manageCookies") }));

const sw = (category: "analytics" | "marketing") =>
  screen.getByRole("switch", { name: text(h.locale, `cookie.${category}.title`) });

function captureUpdates() {
  const events: Array<{ analytics: boolean; marketing: boolean }> = [];
  const listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener("cookie-consent-updated", listener);
  return { events, stop: () => window.removeEventListener("cookie-consent-updated", listener) };
}

beforeEach(() => {
  h.locale = "en";
  window.localStorage.clear();
});

describe("first visit", () => {
  it("shows the bar with Accept and Reject side by side, and no close button", () => {
    renderPage();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("en", "cookie.accept") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("en", "cookie.reject") })).toBeInTheDocument();
    // Nothing is saved yet, so the bar cannot be dismissed unchanged.
    expect(screen.queryByRole("button", { name: text("en", "cookie.close") })).toBeNull();
  });

  it("Accept and Reject are the same size (equal prominence)", () => {
    renderPage();
    const accept = screen.getByRole("button", { name: text("en", "cookie.accept") });
    const reject = screen.getByRole("button", { name: text("en", "cookie.reject") });
    for (const cls of ["h-11", "px-5"]) {
      expect(accept.className).toContain(cls);
      expect(reject.className).toContain(cls);
    }
  });

  it("Reject saves an all-off choice and hides the bar", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.reject") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getCookiePreferences()).toMatchObject({ analytics: false, marketing: false });
  });

  it("Accept saves an all-on choice and hides the bar", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.accept") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getCookiePreferences()).toMatchObject({ analytics: true, marketing: true });
  });
});

describe("first visit: a language switch is not an answer", () => {
  it("the bar is still shown to a visitor who only changed language", () => {
    setLanguagePreference("fr");
    renderPage();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(hasConsentChoice()).toBe(false);
  });

  it("nothing is saved as a refusal behind the visitor's back", () => {
    setLanguagePreference("id");
    expect(window.localStorage.getItem("cookie-consent-preferences")).toBeNull();
    expect(getCookiePreferences()).toBeNull();
  });
});

describe.each([
  ["en", "/en/cookie-policy"],
  ["fr", "/cookie-policy"],
  ["id", "/id/cookie-policy"],
] as const)("first visit: what the bar tells the visitor (%s)", (locale, policyHref) => {
  it("names analytics (Google Analytics, Vercel) and advertising measurement (Meta), not just 'visits'", () => {
    h.locale = locale;
    renderPage();
    const description = text(locale, "cookie.description");

    // textContent, not getByText: the French copy holds no-break spaces, which getByText normalizes away.
    expect(screen.getByRole("dialog").textContent).toContain(description);
    for (const vendor of ["Google Analytics", "Vercel", "Meta"]) {
      expect(description).toContain(vendor);
    }
    // The old wording only promised to "track your visits".
    expect(description).not.toMatch(/track your visits|suivrons vos visites|melacak kunjungan/i);
    // French: no plain space before a colon (no-break space instead).
    if (locale === "fr") expect(description).not.toMatch(/ [:;?!]/);
  });

  it("links the localized Cookie Policy from the bar and from its settings view", () => {
    h.locale = locale;
    renderPage();
    const dialog = screen.getByRole("dialog");
    const label = text(locale, "footer.linkCookies");

    const link = within(dialog).getByRole("link", { name: label });
    expect(link.getAttribute("href")).toBe(policyHref);
    expect(link.className).toContain("min-h-11");

    fireEvent.click(within(dialog).getByRole("button", { name: text(locale, "cookie.customize") }));
    expect(within(dialog).getByRole("link", { name: label }).getAttribute("href")).toBe(policyHref);
  });

  it("keeps Accept, Reject and Customize at a 44px touch target", () => {
    h.locale = locale;
    renderPage();
    for (const name of ["cookie.accept", "cookie.reject"]) {
      expect(screen.getByRole("button", { name: text(locale, name) }).className).toContain("h-11");
    }
    expect(
      screen.getByRole("button", { name: text(locale, "cookie.customize") }).className
    ).toContain("min-h-11");
  });
});

describe("the fixed bar and the app zoom", () => {
  it("every viewport unit in the bar's classes is divided by --app-zoom", () => {
    renderPage();
    const tokens = screen.getByRole("dialog").className.split(/\s+/);
    const viewportTokens = tokens.filter((c) => /\d+[a-z]?v[hw]\b/.test(c));

    expect(viewportTokens).toContain("max-h-[calc(90dvh/var(--app-zoom,1))]");
    for (const token of viewportTokens) expect(token).toContain("var(--app-zoom,1)");
  });
});

describe("Manage cookies (footer) after a choice was saved", () => {
  it("the bar stays hidden on load, then the footer button reopens it on the settings view", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    renderPage();
    expect(screen.queryByRole("dialog")).toBeNull();

    openFromFooter();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(text("en", "cookie.settingsTitle"))).toBeInTheDocument();
  });

  it("the toggles show the CURRENT saved choice, not the defaults", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    renderPage();
    openFromFooter();
    expect(sw("analytics")).toHaveAttribute("aria-checked", "true");
    expect(sw("marketing")).toHaveAttribute("aria-checked", "false");
  });

  it("shows the opposite state for the opposite saved choice", () => {
    setCookiePreferences({ analytics: false, marketing: true });
    renderPage();
    openFromFooter();
    expect(sw("analytics")).toHaveAttribute("aria-checked", "false");
    expect(sw("marketing")).toHaveAttribute("aria-checked", "true");
  });

  it("withdrawing: toggle off + Save updates the record, dispatches the update event, hides the bar", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    renderPage();
    const { events, stop } = captureUpdates();

    openFromFooter();
    fireEvent.click(sw("analytics"));
    expect(sw("analytics")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.save") }));
    stop();

    expect(getCookiePreferences()).toMatchObject({ analytics: false, marketing: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ analytics: false, marketing: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changing the switches without saving changes nothing", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    renderPage();
    openFromFooter();
    fireEvent.click(sw("analytics"));
    fireEvent.click(sw("marketing"));
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.close") }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getCookiePreferences()).toMatchObject({ analytics: true, marketing: true });
  });

  it("reopening again shows the saved choice, not the discarded edits", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    renderPage();
    openFromFooter();
    fireEvent.click(sw("analytics"));
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.close") }));

    openFromFooter();
    expect(sw("analytics")).toHaveAttribute("aria-checked", "true");
  });

  it("Back leads to the one-click Reject / Accept, and Reject withdraws everything", () => {
    setCookiePreferences({ analytics: true, marketing: true });
    renderPage();
    openFromFooter();
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.back") }));
    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.reject") }));

    expect(getCookiePreferences()).toMatchObject({ analytics: false, marketing: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape closes a reopened bar and leaves the choice alone", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    renderPage();
    openFromFooter();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getCookiePreferences()).toMatchObject({ analytics: true, marketing: false });
  });

  it("Escape does nothing on a first-visit bar, which needs an answer", () => {
    renderPage();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(hasConsentChoice()).toBe(false);
  });

  it("moves focus into the reopened bar and back to the footer button when it closes", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    renderPage();
    const trigger = screen.getByRole("button", { name: text("en", "footer.manageCookies") });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: text("en", "cookie.close") }));
    expect(trigger).toHaveFocus();
  });

  it("works while the first-visit bar is still open (no saved choice yet)", () => {
    renderPage();
    openFromFooter();
    expect(sw("analytics")).toHaveAttribute("aria-checked", "false");
    expect(sw("marketing")).toHaveAttribute("aria-checked", "false");
  });

  it("the open event alone (any caller) reopens it", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    render(<CookieConsentBar />);
    act(() => {
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_EVENT));
    });
    expect(sw("analytics")).toHaveAttribute("aria-checked", "true");
  });
});

describe("the footer control", () => {
  it("is a real button, at least 44px tall, in the Legal column next to the Cookie Policy link", () => {
    renderPage();
    const button = screen.getByRole("button", { name: text("en", "footer.manageCookies") });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("min-h-11");
    // The bar carries a Cookie Policy link of its own, so look inside the footer.
    expect(button.closest("ul")).toContainElement(
      within(screen.getByRole("contentinfo")).getByRole("link", {
        name: text("en", "footer.linkCookies"),
      })
    );
  });

  it("is reachable and operable with the keyboard alone (native button focus + click)", () => {
    setCookiePreferences({ analytics: true, marketing: false });
    renderPage();
    const button = screen.getByRole("button", { name: text("en", "footer.manageCookies") });
    button.focus();
    expect(button).toHaveFocus();
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);
  });
});

describe.each([
  ["en", "Manage cookies"],
  ["fr", "Gérer les cookies"],
  ["id", "Kelola cookie"],
] as const)("%s", (locale, label) => {
  it(`labels the footer control "${label}" and reopens the bar in that language`, () => {
    h.locale = locale;
    setCookiePreferences({ analytics: true, marketing: false });
    const { container } = renderPage();

    openFromFooter();

    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(sw("analytics")).toHaveAttribute("aria-checked", "true");
    expect(sw("marketing")).toHaveAttribute("aria-checked", "false");
    // Every string on the bar and the footer resolves in this locale, including "Always on".
    expect(container.textContent).not.toContain("MISSING(");
    expect(screen.getByText(text(locale, "cookie.always"))).toBeInTheDocument();
  });
});

describe("locale copy", () => {
  it("the three labels are real translations, not the English string reused", () => {
    expect(text("fr", "footer.manageCookies")).not.toBe(text("en", "footer.manageCookies"));
    expect(text("id", "footer.manageCookies")).not.toBe(text("en", "footer.manageCookies"));
    expect(text("fr", "cookie.always")).not.toBe(text("en", "cookie.always"));
    expect(text("id", "cookie.always")).not.toBe(text("en", "cookie.always"));
  });

  it("the cookie policy describes the footer control, not a browser-settings workaround", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      const s2 = lookup(DICTS[locale], "cookiePolicy.s2") as Record<string, string>;
      // The withdrawal item names the control by its own label.
      expect(s2.item4).toContain(text(locale, "footer.manageCookies"));
      expect(s2.item4).not.toMatch(/clear this site|effacez les données|hapus data situs/i);
      // The old "scripts are downloaded before you choose" statement is gone.
      expect(s2.item2).not.toMatch(
        /already download|télécharger les scripts|sudah mengunduh|contacte bien|memang menghubungi/i
      );
    }
    // French: no plain space before a colon (no-break space instead).
    const fr = lookup(DICTS.fr, "cookiePolicy.s2") as Record<string, string>;
    expect(fr.item2).not.toMatch(/ [:;?!]/);
    expect(fr.item4).not.toMatch(/ [:;?!]/);
  });
});
