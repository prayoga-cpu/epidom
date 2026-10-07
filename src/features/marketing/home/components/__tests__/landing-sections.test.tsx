import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLocale = vi.hoisted(() => ({ value: "fr" as "en" | "fr" | "id" }));
const session = vi.hoisted(() => ({ user: null as null | { id: string } }));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));

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
import { SourcesSection } from "../sources-section";
import { ThreeSpacesSection } from "../three-spaces-section";
import { FinalCtaSection } from "../final-cta-section";
import { SOURCE_IDS, sourceAnchor } from "../../data/sources";
import { PAINS } from "../../data/problems";
import { POS_TRIAL_REGISTER_HREF } from "@/features/onboarding/lib/plan-intent";
import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/version";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";

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
    ["fr", "Pilotez tout, de la commande à la marge."],
    ["en", "Orders to Margin Controller"],
    ["id", "Kendali penuh, dari pesanan ke margin."],
  ] as const)("%s: one h1, the orders-to-margin headline", (loc, headline) => {
    mockLocale.value = loc;
    render(<HeroSection onOpenMigration={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(headline);
  });

  it("puts the gold trial pill first and the calculator (text only) second", () => {
    render(<HeroSection onOpenMigration={() => {}} />);
    const trial = screen.getByRole("link", { name: text("fr", "redesign.landing.hero.ctaTrial") });
    const calc = screen.getByRole("link", {
      name: text("fr", "redesign.landing.hero.ctaCalculator"),
    });
    expect(trial.compareDocumentPosition(calc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trial.className).toMatch(/bg-epi-gold-500/);
    expect(calc.className).not.toMatch(/\bbg-/);
  });

  it("sets the headline in the brand display face, with the *marked* words in gold", () => {
    mockLocale.value = "en";
    render(<HeroSection onOpenMigration={() => {}} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toMatch(/epi-display/);
    expect(h1.textContent).not.toContain("*");
    expect(within(h1).getByText("Margin").className).toMatch(/text-epi-gold-400/);
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
        timeZone: "UTC",
      }).format(new Date(`${APP_RELEASE_DATE}T00:00:00Z`));

    it("lists the free storefront, WhatsApp support and the running build's release", () => {
      render(<HeroSection onOpenMigration={() => {}} />);
      const facts = screen.getByText("Vitrine").closest("dl")!;
      expect(
        within(facts).getByText(text("fr", "redesign.landing.hero.storefrontValue"))
      ).toBeInTheDocument();
      expect(
        within(facts).getByText(text("fr", "redesign.landing.hero.supportValue"))
      ).toBeInTheDocument();
      expect(
        within(facts).getByText(text("fr", "redesign.landing.hero.releaseLabel"))
      ).toBeInTheDocument();
      expect(plain(within(facts).getByText(new RegExp(`/ ${APP_VERSION}$`)).textContent)).toBe(
        plain(`${releaseDay("fr-FR")} / ${APP_VERSION}`)
      );
    });

    it("en: the release date reads the English way", () => {
      mockLocale.value = "en";
      render(<HeroSection onOpenMigration={() => {}} />);
      expect(screen.getByText(new RegExp(`/ ${APP_VERSION}$`)).textContent).toBe(
        `${releaseDay("en-US")} / ${APP_VERSION}`
      );
    });
  });
});

// ── Problem picker ───────────────────────────────────────────────────────────

describe("ProblemPickerSection", () => {
  it("opens on Commissions, so the panel is never empty", () => {
    render(<ProblemPickerSection onOpenCalculator={() => {}} />);
    const chip = screen.getByRole("button", { name: "Commissions" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", {
        name: text("fr", "redesign.landing.picker.pains.commissions.pain"),
      })
    ).toBeInTheDocument();
  });

  it("switching pain updates the panel and is tracked; the panel is a polite live region", () => {
    const { container } = render(<ProblemPickerSection onOpenCalculator={() => {}} />);
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
    render(<ProblemPickerSection onOpenCalculator={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "queues" } });
    expect(screen.getByText("données US")).toBeInTheDocument();
  });

  it("the commissions button hands the 30 % platform rate to the calculator", () => {
    const openCalculator = vi.fn();
    render(<ProblemPickerSection onOpenCalculator={openCalculator} />);
    const cta = screen.getByRole("link", { name: "Calculer mes commissions" });
    expect(cta).toHaveAttribute("href", "#calculator");
    fireEvent.click(cta);
    expect(openCalculator).toHaveBeenCalledWith({ commission: 30 });
    expect(analytics.trackEvent).toHaveBeenCalledWith("problem_cta_click", {
      pain_id: "commissions",
      cta: "calculator",
    });
  });

  it("commissions is sold as POS, never Free (online ordering is a POS feature)", () => {
    expect(PAINS.find((p) => p.id === "commissions")?.plans).toEqual(["POS"]);
    render(<ProblemPickerSection onOpenCalculator={() => {}} />);
    const panel = screen.getByRole("article");
    expect(within(panel).getByText("POS")).toBeInTheDocument();
    expect(within(panel).queryByText("Free")).toBeNull();
  });

  it("the stock button goes to the stock guide in the visitor's language", () => {
    mockLocale.value = "en";
    render(<ProblemPickerSection onOpenCalculator={() => {}} />);
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

  it("fr: keep my till + online ordering, 1 outlet → POS trial, with the till kept", () => {
    render(<MigrationModal open onClose={() => {}} />);
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
      current_pos: "zelty",
      path: "A",
      outlets: "1",
    });
  });

  it("keep my till + margin says, on the card, what only works with Epidom sales", () => {
    render(<MigrationModal open onClose={() => {}} />);
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

  it("4+ outlets goes to WhatsApp", () => {
    render(<MigrationModal open onClose={() => {}} />);
    answer("Tiller");
    answer("Garder ma caisse, ajouter la commande en ligne");
    answer("4 et plus");
    const link = within(screen.getByTestId("migration-result")).getByRole("link", {
      name: "Parler sur WhatsApp",
    });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\//);
  });

  it("en: the full switch is offered, and 2-3 outlets explains the move to Operations", () => {
    mockLocale.value = "en";
    render(<MigrationModal open onClose={() => {}} />);
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
    answer("Lightspeed");
    answer("Retour");
    expect(screen.getByText("Qu'utilisez-vous aujourd'hui ?")).toBeInTheDocument();

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
});

// ── Sources ──────────────────────────────────────────────────────────────────

describe("Sources", () => {
  it.each(["fr", "en", "id"] as const)(
    "%s: every source has a line, and every footnote on the page points at one",
    (loc) => {
      mockLocale.value = loc;
      const { container } = render(
        <>
          <ProblemPickerSection onOpenCalculator={() => {}} />
          <MarginCalculatorSection preset={null} />
          <SourcesSection />
        </>
      );
      for (const sid of SOURCE_IDS) {
        const line = container.querySelector(`#${sourceAnchor(sid)}`);
        expect(line, sid).not.toBeNull();
        expect(line?.textContent).not.toContain("redesign.landing");
      }
      const refs = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#source-"]'));
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(container.querySelector(ref.getAttribute("href")!), ref.href).not.toBeNull();
      }
    }
  );

  it("every pain with a figure names its source", () => {
    for (const pain of PAINS) {
      if (pain.id === "apps") expect(pain.numberSource).toBeNull();
      else expect(pain.numberSource, pain.id).not.toBeNull();
    }
  });
});
