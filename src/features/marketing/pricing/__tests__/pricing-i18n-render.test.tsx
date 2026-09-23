import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, isInaccessible } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// Real dictionaries (not a hand-written key map) so these tests fail when a
// string is missing from a locale, which t() would otherwise hide by silently
// falling back to English.
const state = vi.hoisted(() => ({
  locale: "fr" as "en" | "fr" | "id",
  // Signed in by default: the confirm dialog is only reached by a signed-in visitor.
  user: { id: "u1" } as { id: string } | null,
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/components/lang/i18n-provider", async () => {
  const { en, fr, id } = await import("@/locales/en").then(async (e) => ({
    en: e.en,
    fr: (await import("@/locales/fr")).fr,
    id: (await import("@/locales/id")).id,
  }));
  const dicts = { en, fr, id } as Record<string, unknown>;
  const lookup = (dict: unknown, key: string): string | undefined => {
    const v = key
      .split(".")
      .reduce<unknown>(
        (n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined),
        dict
      );
    return typeof v === "string" ? v : undefined;
  };
  return {
    useI18n: () => ({
      locale: state.locale,
      t: (key: string) => lookup(dicts[state.locale], key) ?? lookup(dicts.en, key) ?? key,
    }),
  };
});

// The real hook fetches /api/session; the tests decide who is signed in instead.
vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: state.user, loading: false, session: null }),
}));

// The global next/navigation mock builds a fresh router per call, whose push
// can't be asserted on.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// A signed-out visitor is sent away with `window.location.href = ...`, which
// jsdom does not implement: swap in a plain object for the tests that read it.
const realLocation = window.location;
function stubLocation() {
  Object.defineProperty(window, "location", {
    value: { href: "", search: "", pathname: "/pricing" },
    writable: true,
    configurable: true,
  });
}
afterEach(() => {
  Object.defineProperty(window, "location", {
    value: realLocation,
    writable: true,
    configurable: true,
  });
});

import { PricingCards } from "../components/pricing-cards";
import { FeatureComparison } from "../components/feature-comparison";
import { PricingFaq } from "../components/pricing-faq";
import { FaqSection } from "@/features/marketing/home/components/faq-section";
import { PricingSection } from "@/features/marketing/home/components/pricing-section";
import { SUPPORT_EMAIL_DISPLAY, SUPPORT_MAILTO } from "@/lib/constants/contact";

// The three dictionaries are structurally different types (each has keys the
// others lack), so the helpers take them as unknown and read one section.
const section = (l: unknown, name: string) =>
  (l as { redesign: Record<string, Record<string, string>> }).redesign[name];
const pricing = (l: unknown) => section(l, "pricingPage");
const faq = (l: unknown) => section(l, "faq");

beforeEach(() => {
  mockFetch.mockReset();
  push.mockClear();
  state.locale = "fr";
  state.user = { id: "u1" };
});

// Words that promise a free trial, in the three site languages.
const TRIAL = /trial|essai|uji coba/i;

function cardOf(container: HTMLElement, plan: string) {
  return container.querySelector<HTMLElement>(`[data-plan="${plan}"]`)!;
}

describe("PricingCards confirm dialog", () => {
  it("is fully French under fr: trial variant", () => {
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "POS")).getByRole("button", { name: /essai/i }));

    const dialog = screen.getByRole("dialog");
    const d = within(dialog);
    expect(d.getByText(pricing(fr).dlgEyebrow)).toBeTruthy();
    expect(d.getByText("Démarrer l'essai gratuit POS")).toBeTruthy();
    // The emphasised phrase is its own <strong>, the {name} is filled in.
    expect(d.getByText("rien ne sera débité pendant 14 jours").tagName).toBe("STRONG");
    expect(d.getByText("POS", { selector: "strong" })).toBeTruthy();
    expect(d.getByRole("button", { name: "Annuler" })).toBeTruthy();
    expect(d.getByRole("button", { name: "Confirmer" })).toBeTruthy();

    // Nothing from the old hardcoded English survives.
    expect(dialog.textContent).not.toMatch(
      /Confirm Plan Change|free trial|won't be charged|Cancel|Confirm\b/
    );
  });

  it("is fully French under fr: plain plan switch", () => {
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "OPERATIONS")).getAllByRole("button")[0]);

    const d = within(screen.getByRole("dialog"));
    expect(d.getByText("Passer à Opérations")).toBeTruthy();
    expect(d.getByText("Opérations", { selector: "strong" })).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("passera immédiatement au forfait");
  });

  it("keeps the English wording identical under en", () => {
    state.locale = "en";
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "POS")).getByRole("button", { name: /trial/i }));
    const d = within(screen.getByRole("dialog"));
    expect(d.getByText("Confirm Plan Change")).toBeTruthy();
    expect(d.getByText("Start POS free trial")).toBeTruthy();
    expect(d.getByText("won't be charged for 14 days").tagName).toBe("STRONG");
    expect(d.getByText("Cancel")).toBeTruthy();
    expect(d.getByText("Confirm")).toBeTruthy();
  });

  it("speaks Indonesian under id", () => {
    state.locale = "id";
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "OPERATIONS")).getAllByRole("button")[0]);
    const d = within(screen.getByRole("dialog"));
    expect(d.getByText("Ganti ke Operations")).toBeTruthy();
    expect(d.getByRole("button", { name: "Batal" })).toBeTruthy();
  });

  it("shows a localised error when the network fails", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to fetch"));
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "OPERATIONS")).getAllByRole("button")[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmer" }));
    await waitFor(() => {
      expect(screen.getByText(pricing(fr).errNetwork)).toBeTruthy();
    });
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });
});

describe("PricingCards labels", () => {
  it("localises the /mo suffix and the yearly trial note", () => {
    const { container } = render(<PricingCards yearly />);
    expect(within(cardOf(container, "POS")).getByText("/mois")).toBeTruthy();
    expect(
      within(cardOf(container, "POS")).getByText(new RegExp(pricing(fr).promoTrialNoteYearly))
    ).toBeTruthy();
    expect(container.textContent).not.toContain("then billed monthly");
  });

  it("says 'billed monthly' on the trial note when the monthly toggle is on", () => {
    const { container } = render(<PricingCards yearly={false} />);
    expect(
      within(cardOf(container, "POS")).getByText(new RegExp(pricing(fr).promoTrialNote))
    ).toBeTruthy();
  });

  it("Free does not claim a POS or KDS", () => {
    state.locale = "en";
    const { container } = render(<PricingCards yearly={false} />);
    expect(cardOf(container, "FREE").textContent).not.toMatch(/POS|KDS/);
  });
});

describe("most-popular mark", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("appears exactly once, on POS, in %s", (locale, dict) => {
    state.locale = locale;
    const { container } = render(<PricingCards yearly={false} />);
    const label = pricing(dict).mostPopular;
    const hits = screen.getAllByText(label);
    expect(hits).toHaveLength(1);
    expect(cardOf(container, "POS").contains(hits[0])).toBe(true);
    for (const other of ["FREE", "OPERATIONS", "ENTERPRISE"]) {
      expect(cardOf(container, other).textContent).not.toMatch(/popul/i);
    }
  });
});

describe("home pricing teaser", () => {
  it("emphasises POS, not Operations, and no card says 'popular'", () => {
    state.locale = "en";
    const { container } = render(<PricingSection />);
    expect(container.textContent).not.toMatch(/popul/i);
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".cursor-pointer")).filter(
      (el) => el.style.borderColor !== undefined && el.textContent?.includes("per month")
    );
    const highlighted = cards.filter((c) => c.style.borderColor.includes("217, 174, 59"));
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toContain("POS");
  });
});

describe("FAQ sections", () => {
  it("/pricing shows its own questions, including trial, plan change and refund", () => {
    state.locale = "en";
    render(<PricingFaq />);
    for (const q of [faq(en).pTrialQ, faq(en).pSwitchQ, faq(en).pRefundQ]) {
      expect(screen.getByText(q)).toBeTruthy();
    }
    // Homepage questions that do not belong on a pricing page are not repeated.
    expect(screen.queryByText(faq(en).q2)).toBeNull();
    expect(screen.queryByText(faq(en).q4)).toBeNull();
  });

  it("the refund answer links to the localised refund policy", () => {
    for (const [locale, dict, href] of [
      ["fr", fr, "/refund-policy"],
      ["en", en, "/en/refund-policy"],
      ["id", id, "/id/refund-policy"],
    ] as const) {
      state.locale = locale;
      const { unmount } = render(<PricingFaq />);
      const link = screen.getByText(faq(dict).pRefundLink).closest("a");
      expect(link?.getAttribute("href")).toBe(href);
      unmount();
    }
  });

  it("the homepage FAQ still renders exactly its original six questions", () => {
    state.locale = "en";
    render(<FaqSection />);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByText(faq(en)[`q${n}`])).toBeTruthy();
    }
    expect(screen.queryByText(faq(en).pTrialQ)).toBeNull();
    expect(screen.queryByText(faq(en).pRefundQ)).toBeNull();
  });

  it("reads the support address from the shared constants", () => {
    state.locale = "en";
    render(<FaqSection />);
    const mail = screen.getByText(SUPPORT_EMAIL_DISPLAY).closest("a");
    expect(mail?.getAttribute("href")).toBe(SUPPORT_MAILTO);
  });

  it("opens and closes an answer with the keyboard-reachable button", () => {
    state.locale = "en";
    render(<FaqSection />);
    const q2 = screen.getByRole("button", { name: new RegExp(faq(en).q2.slice(0, 12)) });
    expect(q2.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(q2);
    expect(q2.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(q2);
    expect(q2.getAttribute("aria-expanded")).toBe("false");
  });

  it("puts the trial, switching and refund answers in the JSON-LD", () => {
    state.locale = "en";
    const { container } = render(<PricingFaq />);
    const ld = container.querySelector('script[type="application/ld+json"]')!.textContent!;
    expect(ld).toContain(faq(en).pTrialQ);
    expect(ld).toContain("refund");
  });
});

describe("PricingCards for a signed-out visitor, real dictionaries", () => {
  beforeEach(() => {
    state.user = null;
  });

  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("only the POS card promises a trial in %s", (locale, dict) => {
    state.locale = locale;
    const { container } = render(<PricingCards yearly={false} />);

    for (const plan of ["FREE", "OPERATIONS", "ENTERPRISE"]) {
      expect(cardOf(container, plan).textContent).not.toMatch(TRIAL);
    }
    expect(within(cardOf(container, "POS")).getByRole("button").textContent).toBe(
      pricing(dict).startTrialCta
    );
    // Operations' button names the plan; it used to read "Start free trial".
    expect(within(cardOf(container, "OPERATIONS")).getByRole("button").textContent).toBe(
      pricing(dict).t3cta
    );
  });

  it("fr: an Operations click goes straight to sign-up and returns to /pricing", () => {
    stubLocation();
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "OPERATIONS")).getByRole("button"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe("/register?next=%2Fpricing");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("en: the trial bar comes back to /en/pricing?trial=true after sign-up", () => {
    stubLocation();
    state.locale = "en";
    render(<PricingCards yearly={false} />);
    // The bar's label is the same text as the POS card's; it is the one outside a card.
    const bar = screen
      .getAllByRole("button", { name: pricing(en).trialBarCta })
      .find((button) => !button.closest("[data-plan]"))!;
    fireEvent.click(bar);
    expect(window.location.href).toBe(
      "/register?next=" + encodeURIComponent("/en/pricing?trial=true")
    );
  });
});

describe("PricingCards checkout error", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("shows the customer-neutral start error in %s", async (locale, dict) => {
    state.locale = locale;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    });
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(within(cardOf(container, "OPERATIONS")).getByRole("button"));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button")[1]);
    await waitFor(() => {
      expect(screen.getByText(pricing(dict).errCheckoutStart)).toBeTruthy();
    });
  });
});

describe("FeatureComparison", () => {
  it.each([
    ["fr", fr, "/compare/delivery-commission"],
    ["en", en, "/en/compare/delivery-commission"],
    ["id", id, "/id/compare/delivery-commission"],
  ] as const)(
    "%s: translated Feature header and a link in the visitor's language",
    (locale, dict, href) => {
      state.locale = locale;
      render(<FeatureComparison />);
      expect(screen.getByRole("columnheader", { name: pricing(dict).cmpFeature })).toBeTruthy();
      const link = screen.getByText(pricing(dict).compareDeliveryLink).closest("a");
      expect(link?.getAttribute("href")).toBe(href);
    }
  );

  it("does not leave the hardcoded English header in fr or id", () => {
    for (const locale of ["fr", "id"] as const) {
      state.locale = locale;
      const { unmount } = render(<FeatureComparison />);
      expect(screen.queryByRole("columnheader", { name: "Feature" })).toBeNull();
      unmount();
    }
  });
});

describe("home pricing teaser navigation", () => {
  it.each([
    ["fr", fr, "/pricing"],
    ["en", en, "/en/pricing"],
    ["id", id, "/id/pricing"],
  ] as const)("%s: the button and all four cards open %s", (locale, dict, path) => {
    state.locale = locale;
    const { container } = render(<PricingSection />);

    const teaser = section(dict, "pricingTeaser");
    fireEvent.click(screen.getByRole("button", { name: teaser.fullComparison }));
    expect(push).toHaveBeenLastCalledWith(path);

    const cards = container.querySelectorAll<HTMLElement>("div.cursor-pointer");
    expect(cards).toHaveLength(4);
    push.mockClear();
    cards.forEach((card) => fireEvent.click(card));
    expect(push.mock.calls).toEqual([[path], [path], [path], [path]]);
  });
});

describe("FAQ accordion accessibility", () => {
  const answerPanel = (button: HTMLElement) =>
    document.getElementById(button.getAttribute("aria-controls")!)!;

  it("hides a closed answer from the accessibility tree and shows the open one", () => {
    state.locale = "en";
    render(<FaqSection />);
    const q1 = screen.getByRole("button", { name: new RegExp(faq(en).q1.slice(0, 12)) });
    const q2 = screen.getByRole("button", { name: new RegExp(faq(en).q2.slice(0, 12)) });

    // The first question starts open.
    expect(q1.getAttribute("aria-expanded")).toBe("true");
    expect(answerPanel(q1)).toBeVisible();
    expect(isInaccessible(screen.getByText(faq(en).a1))).toBe(false);

    expect(q2.getAttribute("aria-expanded")).toBe("false");
    expect(answerPanel(q2)).not.toBeVisible();
    expect(isInaccessible(answerPanel(q2))).toBe(true);
    expect(isInaccessible(screen.getByText(faq(en).a2))).toBe(true);

    fireEvent.click(q2);
    expect(q2.getAttribute("aria-expanded")).toBe("true");
    expect(isInaccessible(screen.getByText(faq(en).a2))).toBe(false);
    // Opening one closes the other, and that one leaves the tree too.
    expect(q1.getAttribute("aria-expanded")).toBe("false");
    expect(isInaccessible(screen.getByText(faq(en).a1))).toBe(true);

    fireEvent.click(q2);
    expect(q2.getAttribute("aria-expanded")).toBe("false");
    expect(isInaccessible(screen.getByText(faq(en).a2))).toBe(true);
  });

  it("keeps the collapse animation: the height still transitions, visibility flips last", () => {
    state.locale = "en";
    render(<FaqSection />);
    const q1 = screen.getByRole("button", { name: new RegExp(faq(en).q1.slice(0, 12)) });
    const q2 = screen.getByRole("button", { name: new RegExp(faq(en).q2.slice(0, 12)) });
    // Collapsing keeps the panel visible for the length of the transition...
    expect(answerPanel(q2).style.transition).toContain("max-height 0.3s");
    expect(answerPanel(q2).style.transition).toContain("visibility 0s linear 0.3s");
    // ...and expanding makes it visible at once.
    expect(answerPanel(q1).style.transition).not.toContain("0.3s linear");
    expect(answerPanel(q1).style.transition).toContain("visibility 0s");
  });

  it("does not make six landmark regions out of the answers", () => {
    state.locale = "en";
    const { container } = render(<FaqSection />);
    expect(container.querySelectorAll('[role="region"]')).toHaveLength(0);
    expect(screen.queryAllByRole("region", { hidden: true })).toHaveLength(0);
  });

  it("two sections on one page do not share element ids", () => {
    state.locale = "en";
    const { container } = render(
      <>
        <FaqSection />
        <FaqSection />
      </>
    );
    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);

    const [a, b] = Array.from(container.querySelectorAll("section"));
    for (const sectionEl of [a, b]) {
      for (const button of sectionEl.querySelectorAll("button[aria-controls]")) {
        const target = Array.from(sectionEl.querySelectorAll("[id]")).find(
          (el) => el.id === button.getAttribute("aria-controls")
        );
        expect(target).toBeTruthy();
      }
    }
    expect(a.querySelector("button")!.getAttribute("aria-controls")).not.toBe(
      b.querySelector("button")!.getAttribute("aria-controls")
    );
  });

  it("a link under a closed answer is not reachable until the answer is open", () => {
    state.locale = "en";
    render(<PricingFaq />);
    const link = screen.getByText(faq(en).pRefundLink).closest("a")!;
    expect(isInaccessible(link)).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(faq(en).pRefundQ.slice(0, 12)) })
    );
    expect(isInaccessible(link)).toBe(false);
    expect(link).toBeVisible();
  });
});
