import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLocale = vi.hoisted(() => ({ value: "fr" as "en" | "fr" | "id" }));
const session = vi.hoisted(() => ({ user: null as null | { id: string } }));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackMetaPixelEvent: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: session.user, loading: false, session: null }),
}));

vi.mock("@/lib/analytics", () => analytics);

vi.mock("@/components/lang/i18n-provider", async () => {
  const dictionaries = { en, fr, id } as Record<string, unknown>;
  const lookup = (dict: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
        dict
      );
  return {
    INTL_LOCALES: { en: "en-US", fr: "fr-FR", id: "id-ID" },
    useI18n: () => ({
      locale: mockLocale.value,
      t: (key: string) => {
        const value = lookup(dictionaries[mockLocale.value], key) ?? lookup(en, key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

import { HeroSection } from "../hero-section";
import { ProblemPickerSection } from "../problem-picker-section";
import { MarginCalculatorSection } from "../margin-calculator-section";
import { MigrationModal } from "../migration-modal";
import { PricingSection } from "../pricing-section";
import { ThreeSpacesSection } from "../three-spaces-section";
import { PosTourSection } from "../pos-tour-section";
import { FinalCtaSection } from "../final-cta-section";
import { PAINS } from "../../data/problems";
import { PRODUCT_SCREENS } from "@/features/marketing/shared/content/product-screens";
import { POS_TRIAL_REGISTER_HREF } from "@/features/onboarding/lib/plan-intent";
import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/version";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import { WHATSAPP_NUMBERS } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";

const DICTS = { en, fr, id } as const;
type Loc = keyof typeof DICTS;

function text(loc: Loc, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      DICTS[loc]
    );
  if (typeof value !== "string") throw new Error(`${loc} is missing ${path}`);
  return value;
}

/** Intl puts narrow no-break spaces in French amounts; compare on plain spaces. */
const plain = (value: string | null | undefined) => (value ?? "").replace(/\s/g, " ");

beforeEach(() => {
  mockLocale.value = "fr";
  session.user = null;
  analytics.trackEvent.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
});

// ── Hero ─────────────────────────────────────────────────────────────────────

describe("HeroSection", () => {
  it("signed out: the trial goes to sign-up, carrying the POS plan through setup", () => {
    render(<HeroSection onOpenMigration={() => {}} />);
    const trial = screen.getByRole("link", { name: text("fr", "redesign.landing.hero.ctaTrial") });
    expect(trial).toHaveAttribute("href", POS_TRIAL_REGISTER_HREF);
    expect(decodeURIComponent(POS_TRIAL_REGISTER_HREF)).toBe(
      "/register?next=/onboarding?plan=POS&billing=monthly"
    );
  });

  it.each([
    ["fr", "/pricing?trial=true#plans"],
    ["en", "/en/pricing?trial=true#plans"],
    ["id", "/id/pricing?trial=true#plans"],
  ] as const)("%s signed in: the trial opens the POS trial confirm on %s", (loc, href) => {
    mockLocale.value = loc;
    session.user = { id: "u1" };
    render(<HeroSection onOpenMigration={() => {}} />);
    expect(
      screen.getByRole("link", { name: text(loc, "redesign.landing.hero.ctaTrial") })
    ).toHaveAttribute("href", href);
  });

  it("the calculator button jumps to #calculator, and both buttons are tracked", () => {
    render(<HeroSection onOpenMigration={() => {}} />);
    const calc = screen.getByRole("link", {
      name: text("fr", "redesign.landing.hero.ctaCalculator"),
    });
    expect(calc).toHaveAttribute("href", "#calculator");
    fireEvent.click(calc);
    expect(analytics.trackEvent).toHaveBeenCalledWith("hero_cta_click", { cta: "calculator" });

    fireEvent.click(
      screen.getByRole("link", { name: text("fr", "redesign.landing.hero.ctaTrial") })
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith("hero_cta_click", { cta: "trial" });
  });

  it("the 'already have a till' link opens the migration modal", () => {
    const open = vi.fn();
    render(<HeroSection onOpenMigration={open} />);
    fireEvent.click(
      screen.getByRole("button", { name: text("fr", "redesign.landing.hero.migrationLink") })
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    ["fr", "Caisse en temps réel", "avec une marge transparente pour les cafés"],
    ["en", "Realtime POS", "with transparent margin for cafés"],
    ["id", "Kasir realtime", "dengan margin transparan untuk kafe"],
  ] as const)(
    "%s: one h1, only the product, with the margin promise under it",
    (loc, headline, tagline) => {
      mockLocale.value = loc;
      render(<HeroSection onOpenMigration={() => {}} />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      const h1 = screen.getByRole("heading", { level: 1, name: headline });
      const taglineEl = screen.getByText(
        (_, el) => el?.tagName === "P" && el.textContent === tagline
      );
      expect(h1.compareDocumentPosition(taglineEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  );

  it.each([
    ["en", "Realt", "me POS"],
    ["id", "Kasir realt", "me"],
    ["fr", "Caisse en temp", " réel"],
  ] as const)(
    "%s: one letter of realtime is a bolt drawing, hidden from screen readers",
    (loc, before, after) => {
      mockLocale.value = loc;
      render(<HeroSection onOpenMigration={() => {}} />);
      const h1 = screen.getByRole("heading", { level: 1 });
      const bolts = h1.querySelectorAll("svg");
      expect(bolts).toHaveLength(1);
      expect(bolts[0]).toHaveAttribute("aria-hidden", "true");
      // The letter the bolt stands for stays in the drawn copy's text, undrawn,
      // so search engines read "REALTIME" there, not "REALTME".
      const title = text(loc, "redesign.landing.hero.title");
      const letter = bolts[0].parentElement!.querySelector(".sr-only")?.textContent;
      expect(`${before}${letter}${after}`).toBe(title);
      // ...and the h1 holds the title once: no second copy beside the drawing
      // for a crawler to read as "TitleTitle".
      expect(h1.textContent).toBe(title);
      expect(h1).toHaveAttribute("aria-label", title);
    }
  );

  it("puts the gold trial pill first and the calculator (text only) second", () => {
    render(<HeroSection onOpenMigration={() => {}} />);
    const trial = screen.getByRole("link", { name: text("fr", "redesign.landing.hero.ctaTrial") });
    const calc = screen.getByRole("link", {
      name: text("fr", "redesign.landing.hero.ctaCalculator"),
    });
    expect(trial.compareDocumentPosition(calc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trial.className).toMatch(/bg-epi-gold-500|bg-\[linear-gradient/);
    expect(calc.className).not.toMatch(/\bbg-/);
  });

  it("sets the headline in the display face and the tagline on one line in its light companion, one colour", () => {
    mockLocale.value = "en";
    render(<HeroSection onOpenMigration={() => {}} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toMatch(/\bepi-display\b/);
    const taglineEl = screen.getByText(
      (_, el) => el?.tagName === "P" && el.textContent === "with transparent margin for cafés"
    );
    expect(taglineEl.className).toMatch(/\bepi-display-light\b/);
    expect(taglineEl.className).toMatch(/whitespace-nowrap/);
    expect(taglineEl.querySelector("[class*='gold']")).toBeNull();
    // Sized from its box (as wide as the h1), not a fixed size.
    expect(taglineEl.getAttribute("style")).toMatch(/--tagline-em:\s*[\d.]+/);
    expect(taglineEl.className).toMatch(/100cqi/);
  });

  it("shows the photo with alt text in the visitor's language, loaded eagerly at high priority", () => {
    mockLocale.value = "en";
    render(<HeroSection onOpenMigration={() => {}} />);
    const photo = screen.getByRole("img", { name: /café staff laughing/ });
    expect(photo).toHaveAttribute("fetchpriority", "high");
    expect(photo).not.toHaveAttribute("loading", "lazy");
  });

  describe("facts", () => {
    // UTC-11: a visitor here would see the release day slip to the day before if
    // the date were read in local time.
    beforeEach(() => {
      vi.stubEnv("TZ", "Pacific/Pago_Pago");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const releaseDay = (intlLocale: string) =>
      new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${APP_RELEASE_DATE}T00:00:00Z`));

    it("lists 24h WhatsApp support and the last update, which opens the changelog", () => {
      render(<HeroSection onOpenMigration={() => {}} />);
      const facts = screen.getByText("Support en ligne 24 h/24").closest("dl")!;
      expect(within(facts).getAllByRole("term")).toHaveLength(2);
      expect(within(facts).queryByText("Vitrine")).toBeNull();
      expect(
        within(facts).getByRole("button", { name: "France / Indonésie, par WhatsApp" })
      ).toBeInTheDocument();
      expect(within(facts).getByText("Dernière mise à jour")).toBeInTheDocument();
      const update = within(facts).getByRole("link", { name: new RegExp(`/ ${APP_VERSION}$`) });
      expect(update).toHaveAttribute("href", getLocalizedPath("/changelog", "fr"));
      expect(plain(update.textContent)).toBe(plain(`${releaseDay("fr-FR")} / ${APP_VERSION}`));
    });

    it("en: the update date reads the English way, year included", () => {
      mockLocale.value = "en";
      render(<HeroSection onOpenMigration={() => {}} />);
      expect(screen.getByText("Last updated")).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`/ ${APP_VERSION}$`)).textContent).toBe(
        `${releaseDay("en-US")} / ${APP_VERSION}`
      );
      expect(releaseDay("en-US")).toMatch(/\d{4}$/);
    });

    it.each([
      ["fr", "France / Indonésie, par WhatsApp", ["France", "Indonésie"], ["fr", "id"]],
      ["id", "Prancis / Indonesia, via WhatsApp", ["Indonesia", "Prancis"], ["id", "fr"]],
    ] as const)(
      "%s: support opens both WhatsApp numbers, the visitor's market first",
      (loc, trigger, labels, markets) => {
        mockLocale.value = loc;
        render(<HeroSection onOpenMigration={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: trigger }));
        const links = within(screen.getByRole("dialog")).getAllByRole("link");
        expect(links.map((a) => a.textContent)).toEqual(labels);
        expect(links.map((a) => a.getAttribute("href"))).toEqual(
          markets.map((m) => `https://wa.me/${WHATSAPP_NUMBERS[m].number}`)
        );
        for (const a of links) expect(a).toHaveAttribute("target", "_blank");
      }
    );
  });
});

// ── Problem picker ───────────────────────────────────────────────────────────

describe("ProblemPickerSection", () => {
  it("opens on Commissions, so the panel is never empty", () => {
    render(<ProblemPickerSection />);
    const chip = screen.getByRole("button", { name: "Commissions" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", {
        name: text("fr", "redesign.landing.picker.pains.commissions.pain"),
      })
    ).toBeInTheDocument();
  });

  it("switching pain updates the panel and is tracked; the panel is a polite live region", () => {
    const { container } = render(<ProblemPickerSection />);
    fireEvent.click(screen.getByRole("button", { name: "Coupures" }));
    expect(
      screen.getByRole("heading", {
        name: text("fr", "redesign.landing.picker.pains.outages.pain"),
      })
    ).toBeInTheDocument();
    expect(screen.getByText("estimation du secteur")).toBeInTheDocument();
    expect(analytics.trackEvent).toHaveBeenCalledWith("problem_selected", { pain_id: "outages" });
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("the phone select switches pain too", () => {
    render(<ProblemPickerSection />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "queues" } });
    expect(screen.getByText("données US")).toBeInTheDocument();
  });

  it("the commissions button hands the 30 % platform rate to the home page's calculator", () => {
    render(<ProblemPickerSection />);
    const cta = screen.getByRole("link", { name: "Calculer mes commissions" });
    expect(cta).toHaveAttribute("href", "/?commission=30#calculator");
    fireEvent.click(cta);
    expect(analytics.trackEvent).toHaveBeenCalledWith("problem_cta_click", {
      pain_id: "commissions",
      cta: "calculator",
    });
  });

  it("en: the calculator link stays on the English home page", () => {
    mockLocale.value = "en";
    render(<ProblemPickerSection />);
    expect(screen.getByRole("link", { name: "Calculate my commissions" })).toHaveAttribute(
      "href",
      "/en?commission=30#calculator"
    );
  });

  it("commissions is sold as POS, never Free (online ordering is a POS feature)", () => {
    expect(PAINS.find((p) => p.id === "commissions")?.plans).toEqual(["POS"]);
    render(<ProblemPickerSection />);
    const panel = screen.getByRole("article");
    expect(within(panel).getByText("POS")).toBeInTheDocument();
    expect(within(panel).queryByText("Free")).toBeNull();
  });

  it("the stock button goes to the stock guide in the visitor's language", () => {
    mockLocale.value = "en";
    render(<ProblemPickerSection />);
    fireEvent.click(screen.getByRole("button", { name: "Accurate tracking" }));
    expect(screen.getByRole("link", { name: "See stock tracking" })).toHaveAttribute(
      "href",
      "/en/docs/stock-and-supplier-orders"
    );
  });
});

// ── Calculator ───────────────────────────────────────────────────────────────

describe("MarginCalculatorSection", () => {
  it("shows today's commissions and a saving for the default numbers, with its assumptions", () => {
    render(<MarginCalculatorSection preset={null} />);
    // 30 000 € × 25 % × 30 % = 2 250 € of commissions.
    expect(plain(screen.getByText(/Vous payez environ/).textContent)).toContain("2 250 €");
    expect(plain(screen.getByText(/Hypothèse/).textContent)).toContain("1,5 % + 0,25 €");
    expect(plain(screen.getByText(/Prix du forfait/).textContent)).toContain("13,99 €");
    expect(screen.getByText("Économie par mois")).toBeInTheDocument();
  });

  it("says a negative result plainly and points to the free page", () => {
    render(<MarginCalculatorSection preset={null} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
    expect(screen.getByText(/Epidom vous coûterait/)).toBeInTheDocument();
    expect(screen.queryByText("Économie par mois")).toBeNull();
    expect(screen.getByRole("link", { name: "Créer ma page gratuitement" })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith("calculator_start");
  });

  it("offers only paid plans, and says why Free is not one", () => {
    render(<MarginCalculatorSection preset={null} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/ne prend pas de commandes/)).toBeInTheDocument();
  });

  it("takes the commission preset from the problem picker", () => {
    const { rerender } = render(<MarginCalculatorSection preset={null} />);
    const rate = screen.getByLabelText(/Commission plateforme/) as HTMLInputElement;
    fireEvent.change(rate, { target: { value: "12" } });
    rerender(<MarginCalculatorSection preset={{ commission: 30, nonce: 1 }} />);
    expect(rate.value).toBe("30");
  });

  it("follows the visitor's currency: US dollars on the English site", () => {
    mockLocale.value = "en";
    render(<MarginCalculatorSection preset={null} />);
    expect(screen.getByText(/You pay about/).textContent).toContain("$2,250");
    expect(screen.getByText(/Assumption/).textContent).toContain("2.9% + $0.30");
  });
});

// ── Migration modal ──────────────────────────────────────────────────────────

describe("MigrationModal", () => {
  function answer(label: string | RegExp) {
    fireEvent.click(screen.getByRole("button", { name: label }));
  }

  it("asks where the business is first, the site language's market on top", () => {
    render(<MigrationModal open onClose={() => {}} />);
    expect(screen.getByText("Étape 1 sur 4")).toBeInTheDocument();
    const markets = within(screen.getByRole("group")).getAllByRole("button");
    expect(markets.map((b) => b.textContent)).toEqual(["France", "Indonésie", "Un autre pays"]);
  });

  it.each([
    ["France", ["Zelty", "L'Addition", "Lightspeed", "SumUp", "Tiller"]],
    ["Indonésie", ["Moka", "Majoo", "Pawoon", "ESB POS", "Qasir"]],
    ["Un autre pays", ["Square", "Toast", "Lightspeed", "Clover", "SumUp"]],
  ] as const)("%s lists that market's tills, then other and none", (market, tills) => {
    render(<MigrationModal open onClose={() => {}} />);
    answer(market);
    const options = within(screen.getByRole("group")).getAllByRole("button");
    expect(options.map((b) => b.textContent)).toEqual([...tills, "Autre caisse", "Pas de caisse"]);
  });

  it("fr: keep my till + online ordering, 1 outlet → POS trial, with the till kept", () => {
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("Zelty");
    // No "switch fully" on the French site until NF525 is settled.
    expect(screen.queryByRole("button", { name: "Passer entièrement à Epidom" })).toBeNull();
    answer("Garder ma caisse, ajouter la commande en ligne");
    answer("1");
    const result = screen.getByTestId("migration-result");
    expect(within(result).getAllByText("POS").length).toBeGreaterThan(0);
    expect(within(result).getByText("Votre caisse actuelle, telle quelle.")).toBeInTheDocument();
    expect(within(result).getByRole("link", { name: "Essai POS 14 jours" })).toHaveAttribute(
      "href",
      POS_TRIAL_REGISTER_HREF
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith("migration_path_selected", {
      market: "fr",
      current_pos: "zelty",
      path: "A",
      outlets: "1",
    });
  });

  it("keep my till + margin says, on the card, what only works with Epidom sales", () => {
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("SumUp");
    answer("Garder ma caisse, suivre ma marge et mes recettes");
    answer("2 à 3");
    const result = screen.getByTestId("migration-result");
    expect(
      within(result).getByText(/saisissez les mouvements de stock à la main/)
    ).toBeInTheDocument();
    expect(
      within(result).getByRole("link", { name: "Voir le forfait Opérations" })
    ).toHaveAttribute("href", "/pricing#plans");
  });

  it.each([
    ["France", "Tiller", WHATSAPP_NUMBERS.fr.number],
    ["Indonésie", "Moka", WHATSAPP_NUMBERS.id.number],
  ] as const)("4+ outlets in %s goes to that market's WhatsApp", (market, till, number) => {
    render(<MigrationModal open onClose={() => {}} />);
    answer(market);
    answer(till);
    answer("Garder ma caisse, ajouter la commande en ligne");
    answer("4 et plus");
    const link = within(screen.getByTestId("migration-result")).getByRole("link", {
      name: "Parler sur WhatsApp",
    });
    expect(link).toHaveAttribute("href", `https://wa.me/${number}`);
  });

  it("the NF525 gate follows the business's country, not the site language", () => {
    mockLocale.value = "en";
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("Zelty");
    expect(screen.getByText("How do you want to start?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch fully to Epidom" })).toBeNull();
  });

  it("en: the full switch is offered, and 2-3 outlets explains the move to Operations", () => {
    mockLocale.value = "en";
    render(<MigrationModal open onClose={() => {}} />);
    answer("Another country");
    answer("No POS");
    answer("Run everything on Epidom, till included");
    answer("2 to 3");
    const result = screen.getByTestId("migration-result");
    expect(within(result).getByText(/The POS plan covers one outlet/)).toBeInTheDocument();
    expect(within(result).getByText(/Importing from a spreadsheet/)).toBeInTheDocument();
  });

  it("Back walks back a step; Escape and the 44px close button close it", () => {
    const onClose = vi.fn();
    render(<MigrationModal open onClose={onClose} />);
    answer("France");
    answer("Lightspeed");
    answer("Retour");
    expect(screen.getByText("Qu'utilisez-vous aujourd'hui ?")).toBeInTheDocument();
    answer("Retour");
    expect(screen.getByText("Où se trouve votre commerce ?")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const close = screen.getByRole("button", { name: "Fermer" });
    expect(close.className).toMatch(/size-11/);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("asks for no email", () => {
    render(<MigrationModal open onClose={() => {}} />);
    expect(screen.getByRole("dialog").querySelector("input")).toBeNull();
  });
});

// ── Pricing, spaces, final CTA ──────────────────────────────────────────────

describe("PricingSection", () => {
  it.each([
    ["fr", "13,99 €", "27,99 €", "0 €"],
    ["en", "$14.99", "$29.99", "$0"],
    ["id", "Rp 229k", "Rp 459k", "Rp 0"],
  ] as const)("%s: prices come from the shared price table", (loc, pos, ops, free) => {
    mockLocale.value = loc;
    render(<PricingSection />);
    for (const price of [pos, ops, free]) expect(screen.getByText(price)).toBeInTheDocument();
  });

  it("only POS carries the 'most popular' mark, and Free promises no ordering", () => {
    render(<PricingSection />);
    expect(screen.getAllByText(text("fr", "redesign.pricingPage.mostPopular"))).toHaveLength(1);
    const popular = screen.getByText(text("fr", "redesign.pricingPage.mostPopular")).closest("li");
    expect(popular).toHaveTextContent("POS");
    expect(screen.getByText("Votre vitrine et son QR code, pour toujours.")).toBeInTheDocument();
  });
});

describe("ThreeSpacesSection", () => {
  it("fills in the live storefront link when the streamed slug arrives, and shows none for null", async () => {
    // act() lets React settle the Suspense boundary once the promise resolves.
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ThreeSpacesSection exampleStorefrontSlug={Promise.resolve("le-petit-four")} />
      );
    });
    expect(screen.getByRole("link", { name: /vraie vitrine/ })).toHaveAttribute(
      "href",
      "/@le-petit-four"
    );
    view.unmount();

    await act(async () => {
      render(<ThreeSpacesSection exampleStorefrontSlug={Promise.resolve(null)} />);
    });
    expect(
      screen.getByText(text("fr", onlinePaymentCopyKey("redesign.landing.spaces.storefrontBody")))
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /vraie vitrine/ })).toBeNull();
  });

  it("badges each space with the plan it needs, and links a real storefront when there is one", () => {
    render(<ThreeSpacesSection exampleStorefrontSlug="le-petit-four" />);
    for (const badge of ["Free", "POS", "Opérations"]) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /vraie vitrine/ })).toHaveAttribute(
      "href",
      "/@le-petit-four"
    );
    expect(screen.getByRole("link", { name: "Voir comment ça marche" })).toHaveAttribute(
      "href",
      "/services"
    );
  });

  it("holds the live storefront link's place while its slug streams in, so the calculator below never moves", () => {
    render(<ThreeSpacesSection exampleStorefrontSlug={new Promise<string | null>(() => {})} />);
    expect(screen.queryByRole("link", { name: /vraie vitrine/ })).toBeNull();
    expect(screen.getByTestId("live-example-slot")).toHaveClass("min-h-11");
  });

  it("shows a real screenshot in each card, described in the visitor's language", () => {
    mockLocale.value = "en";
    render(<ThreeSpacesSection exampleStorefrontSlug={null} />);
    for (const shot of [
      PRODUCT_SCREENS.storefrontMenu,
      PRODUCT_SCREENS.posOrderQueue,
      PRODUCT_SCREENS.backOfficeStock,
    ]) {
      expect(screen.getByRole("img", { name: shot.alt.en })).toBeInTheDocument();
    }
  });
});

describe("PosTourSection", () => {
  const tabs = () => screen.getAllByRole("tab");

  it.each(["fr", "en", "id"] as const)("%s: every string it asks for exists", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<PosTourSection />);
    expect(container.textContent).not.toContain("redesign.");
    expect(tabs()).toHaveLength(4);
  });

  it("opens on the cashier, and only the visible view's screenshot is announced", () => {
    mockLocale.value = "en";
    render(<PosTourSection />);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveTextContent(text("en", "redesign.posTour.cashierTab"));
    expect(
      screen.getByRole("img", { name: PRODUCT_SCREENS.posCashier.alt.en })
    ).toBeInTheDocument();
    // The other views stay mounted for an instant switch, hidden from screen readers.
    expect(screen.queryByRole("img", { name: PRODUCT_SCREENS.posOrderQueue.alt.en })).toBeNull();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs()[0].id);
  });

  it("a tap switches the view, its screenshot and its text", () => {
    mockLocale.value = "en";
    render(<PosTourSection />);
    fireEvent.click(screen.getByRole("tab", { name: /Customer screen/ }));
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("img", { name: PRODUCT_SCREENS.posCustomerDisplay.alt.en })
    ).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      text("en", "redesign.posTour.customerBody")
    );
  });

  it("online orders show both phone screens, with the payment line that is true today", () => {
    mockLocale.value = "fr";
    render(<PosTourSection />);
    fireEvent.click(tabs()[3]);
    for (const shot of [PRODUCT_SCREENS.storefrontMenu, PRODUCT_SCREENS.storefrontCheckout]) {
      expect(screen.getByRole("img", { name: shot.alt.fr })).toBeInTheDocument();
    }
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      text("fr", onlinePaymentCopyKey("redesign.posTour.onlineBody"))
    );
  });

  it("arrow keys, Home and End move between tabs (roving focus)", () => {
    render(<PosTourSection />);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    fireEvent.keyDown(tabs()[0], { key: "ArrowLeft" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[3]).toHaveFocus();
    fireEvent.keyDown(tabs()[3], { key: "ArrowRight" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs()[0], { key: "End" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs()[3], { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveFocus();
  });
});

describe("FinalCtaSection", () => {
  it("closes with the trial and WhatsApp, and no email field", () => {
    const { container } = render(<FinalCtaSection />);
    expect(screen.getByRole("link", { name: "Essai POS 14 jours" })).toHaveAttribute(
      "href",
      POS_TRIAL_REGISTER_HREF
    );
    expect(screen.getByRole("link", { name: "Parler sur WhatsApp" }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/33/
    );
    expect(container.querySelector("input")).toBeNull();
  });

  it("a WhatsApp tap is a Contact for Meta", () => {
    analytics.trackMetaPixelEvent.mockClear();
    render(<FinalCtaSection />);
    fireEvent.click(screen.getByRole("link", { name: "Parler sur WhatsApp" }));
    expect(analytics.trackMetaPixelEvent).toHaveBeenCalledWith("Contact", {
      content_name: "final_whatsapp",
    });
  });
});

// ── No Sources list (removed 11.10.2026) ─────────────────────────────────────

describe("Figures without the Sources list", () => {
  it.each(["fr", "en", "id"] as const)("%s: no footnote marker is left behind", (loc) => {
    mockLocale.value = loc;
    const { container } = render(
      <>
        <ProblemPickerSection />
        <MarginCalculatorSection preset={null} />
      </>
    );
    expect(container.querySelector('a[href^="#source-"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\[\d+\]/);
  });

  it("every pain but 'apps' still shows its figure", () => {
    for (const pain of PAINS) expect(pain.hasNumber, pain.id).toBe(pain.id !== "apps");
  });
});
