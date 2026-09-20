import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import type { Locale } from "@/components/lang/i18n-provider";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// The real provider and the real dictionaries are used on purpose: two of the
// findings this file guards are about the words the visitor actually reads.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  trackConversion: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/analytics", () => ({ trackConversion: h.trackConversion }));

import { ClosingCtaSection } from "../closing-cta-section";
import {
  PREFILL_EMAIL_STORAGE_KEY,
  takeStashedPrefillEmail,
} from "@/features/auth/register/lib/prefill-handoff";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DICTS = { en, fr, id } as const;
const LOCALES = ["en", "fr", "id"] as const;
const ADDRESS = "jane+shop@bakery.com";

function renderIn(locale: Locale = "fr") {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <ClosingCtaSection />
    </EagerI18nProvider>
  );
}

const emailInput = () => document.querySelector('input[type="email"]') as HTMLInputElement;
const form = () => emailInput().closest("form") as HTMLFormElement;
const submitButton = () => form().querySelector('button[type="submit"]') as HTMLButtonElement;

/** The visitor types an address and submits (fireEvent.submit skips the browser's own email check). */
function subscribe(address = ADDRESS) {
  fireEvent.change(emailInput(), { target: { value: address } });
  fireEvent.submit(form());
}

const classesOf = (el: Element) => Array.from(el.classList);

beforeEach(() => {
  h.push.mockReset();
  h.trackConversion.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

// ── Privacy: the address must not travel in the URL ──────────────────────────

describe("ClosingCtaSection: the typed address stays out of the URL", () => {
  it("navigates to the plain /register, with no query string at all", () => {
    renderIn();

    subscribe();

    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith("/register");
  });

  it("puts nothing identifying, and no query string at all, in what it navigates to", () => {
    renderIn();

    subscribe();

    const target = String(h.push.mock.calls[0][0]);
    for (const needle of [
      ADDRESS,
      encodeURIComponent(ADDRESS),
      "jane",
      "bakery",
      "email=",
      "?",
      "@",
    ]) {
      expect(target, `contains ${needle}`).not.toContain(needle);
    }
  });

  it("leaves the address in sessionStorage for the sign-up form to take", () => {
    renderIn();

    subscribe();

    expect(window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBe(ADDRESS);
    expect(PREFILL_EMAIL_STORAGE_KEY).toMatch(/^epidom:/);
    expect(takeStashedPrefillEmail()).toBe(ADDRESS);
  });

  it("does not use localStorage or a cookie for it", () => {
    renderIn();

    subscribe();

    expect(window.localStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain("bakery");
    expect(document.cookie).not.toContain(PREFILL_EMAIL_STORAGE_KEY);
  });

  it("writes the address before it navigates, so the next page can find it", () => {
    const order: string[] = [];
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === PREFILL_EMAIL_STORAGE_KEY) order.push("stash");
      realSetItem.call(this, key, value);
    });
    h.push.mockImplementation(() => {
      order.push("push");
    });
    renderIn();

    subscribe();

    expect(order).toEqual(["stash", "push"]);
  });

  it("still navigates when storage throws (private mode, blocked site data)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    renderIn();

    expect(() => subscribe()).not.toThrow();

    expect(h.push).toHaveBeenCalledWith("/register");
  });

  it("does not put the address in the analytics event either", () => {
    renderIn();

    subscribe();

    expect(h.trackConversion).toHaveBeenCalledTimes(1);
    expect(h.trackConversion).toHaveBeenCalledWith("email_capture", {
      event_label: "closing_cta",
    });
    expect(JSON.stringify(h.trackConversion.mock.calls)).not.toContain("bakery");
  });

  it("does nothing without an address", () => {
    renderIn();

    fireEvent.submit(form());

    expect(h.push).not.toHaveBeenCalled();
    expect(h.trackConversion).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(PREFILL_EMAIL_STORAGE_KEY)).toBeNull();
  });
});

// ── Honesty: no magic link is ever sent ──────────────────────────────────────

describe("ClosingCtaSection: the message after submitting is truthful", () => {
  it.each(LOCALES)("says the visitor is being redirected, in %s", (locale) => {
    renderIn(locale);

    subscribe();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(DICTS[locale].redesign.cta.sent);
  });

  it.each(LOCALES)("never claims an email or magic link was sent, in %s", (locale) => {
    renderIn(locale);

    subscribe();

    const text = screen.getByRole("status").textContent ?? "";
    expect(text).not.toMatch(/magic|lien magique|check|vérifiez|cek|inbox|email/i);
    expect(text).not.toContain("{");
    expect(text).not.toContain(ADDRESS);
  });

  it("shows the visitor's address nowhere on the page after submitting", () => {
    const { container } = renderIn("fr");

    subscribe();

    expect(container.textContent).not.toContain("bakery");
    expect(container.textContent).not.toContain("jane");
  });

  it("swaps the form for the message, and only after a submit", () => {
    renderIn();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(form()).toBeInTheDocument();

    subscribe();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(document.querySelector("form")).toBeNull();
  });

  it("depends on no {email} placeholder in any language", () => {
    for (const locale of LOCALES) {
      const sent = DICTS[locale].redesign.cta.sent;
      expect(sent, locale).not.toContain("{email}");
      expect(sent, locale).not.toMatch(/[{}]/);
    }
  });

  it("ships the wording in all three languages, each its own", () => {
    expect(en.redesign.cta.sent).toBe("Taking you to sign-up...");
    expect(fr.redesign.cta.sent).toBe("Nous vous redirigeons vers l'inscription...");
    expect(id.redesign.cta.sent).toBe("Mengarahkan Anda ke pendaftaran...");
  });
});

// ── Layout: jsdom cannot measure, so the responsive classes are the contract ─

describe("ClosingCtaSection: the form stacks on a phone and is a pill from sm up", () => {
  it.each(LOCALES)("renders the same structure in %s", (locale) => {
    renderIn(locale);

    expect(classesOf(form())).toEqual(
      expect.arrayContaining([
        "flex",
        "flex-col", // stacked by default (375px) ...
        "sm:flex-row", // ... side by side from sm up
        "sm:rounded-full", // the pill look, from sm up
        "sm:border",
        "max-w-[520px]",
      ])
    );
    expect(classesOf(form())).not.toContain("flex-row"); // never a bare row (that was the bug)
  });

  it("gives the input a full-width, 48px-tall field when stacked, and hands the row to flex-1 from sm", () => {
    renderIn("fr");

    const input = classesOf(emailInput());
    expect(input).toEqual(
      expect.arrayContaining([
        "h-12",
        "w-full",
        "min-w-0",
        "rounded-full",
        "sm:h-auto",
        "sm:flex-1",
      ])
    );
    // AGENTS.md: in a flex row the field that fills the space uses flex-1, never w-full.
    // w-full is only the stacked (base) state and is released at sm.
    expect(input).not.toContain("sm:w-full");
  });

  it("gives the button a full-width, 48px-tall target when stacked, and its own width from sm", () => {
    renderIn("fr");

    const button = classesOf(submitButton());
    expect(button).toEqual(
      expect.arrayContaining(["h-12", "w-full", "sm:h-auto", "sm:w-auto", "whitespace-nowrap"])
    );
  });

  it("keeps both controls at or above the 44px touch target when stacked", () => {
    renderIn("fr");

    // h-12 is 3rem = 48px; anything smaller (h-10 = 40px, h-11 = 44px is the floor) would break
    // the "44px, never below ~32px" rule in AGENTS.md.
    for (const el of [emailInput(), submitButton()]) {
      const height = classesOf(el).find((c) => /^h-\d+$/.test(c));
      expect(height, "a base (mobile) height class").toBeDefined();
      expect(Number(height!.slice(2)) * 4).toBeGreaterThanOrEqual(44);
    }
  });

  it("drives the layout with classes, not inline styles that would beat the sm: overrides", () => {
    renderIn("fr");

    for (const el of [form(), emailInput(), submitButton()]) {
      expect(el.getAttribute("style")).toBeNull();
    }
  });

  it("keeps the French button label whole (nowrap) rather than letting it wrap or spill", () => {
    renderIn("fr");

    expect(submitButton()).toHaveTextContent(fr.redesign.cta.button);
    expect(classesOf(submitButton())).toContain("whitespace-nowrap");
    // The base padding is the tight one (px-4) so the label still fits a 320px screen.
    expect(classesOf(submitButton())).toContain("px-4");
    expect(classesOf(submitButton())).toContain("sm:px-6");
  });

  it("keeps the input a real, required email field", () => {
    renderIn("en");

    expect(emailInput()).toBeRequired();
    expect(emailInput()).toHaveAttribute("placeholder", en.redesign.cta.placeholder);
  });
});
